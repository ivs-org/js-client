/**
 * audio_processor.js - Audio player with jb, worklet
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

// Проверка наличия AudioWorkletProcessor (для модульной загрузки)
if (typeof AudioWorkletProcessor !== 'undefined') {
    /**
     * AudioProcessor - для воспроизведения аудио
     */
    class AudioProcessor extends AudioWorkletProcessor {
        constructor(options) {
            super();

            const opt = options.processorOptions || {};
            this.channels = opt.channels || 2;
            this.capacity = opt.capacity || 48000; // сэмплов на канал
            this.idx = new Int32Array(opt.idxSAB); // [write, read]
            this.data = (opt.dataSABs || []).map(sab => new Float32Array(sab));

            // простая телеметрия
            this._meterN = 0;
            this._meterEvery = 200; // раз в ~200 вызовов process (~0.7-1.5 c)
        }

        _available() {
            const w = Atomics.load(this.idx, 0);
            const r = Atomics.load(this.idx, 1);
            return (w - r + this.capacity) % this.capacity;
        }

        _readBlock(ch, r, n, out) {
            const buf = this.data[ch];
            const cap = this.capacity;
            const end = r + n;
            if (end <= cap) {
                out.set(buf.subarray(r, end));
            } else {
                const first = cap - r;
                out.set(buf.subarray(r, cap), 0);
                out.set(buf.subarray(0, n - first), first);
            }
        }

        process(_inputs, outputs) {
            const out = outputs[0];
            if (!out || !out[0]) return true;

            const block = out[0].length;
            let avail = this._available();

            if (avail < block) {
                // недокорм — тишина
                for (let ch = 0; ch < out.length; ch++) out[ch].fill(0);
                return true;
            }

            // читаем block сэмплов из кольца
            const r0 = Atomics.load(this.idx, 1);
            for (let ch = 0; ch < out.length; ch++) {
                this._readBlock(ch, r0, block, out[ch]);
            }
            Atomics.store(this.idx, 1, (r0 + block) % this.capacity);

            // метрика
            if (++this._meterN >= this._meterEvery) {
                this._meterN = 0;
                // сколько осталось после чтения
                const w = Atomics.load(this.idx, 0);
                const r = Atomics.load(this.idx, 1);
                const left = (w - r + this.capacity) % this.capacity;
                this.port.postMessage({ type: 'avail', samples: left });
            }

            return true;
        }
    }

    registerProcessor('audio-processor', AudioProcessor);

    /**
     * AudioRecorderProcessor - для захвата аудио с микрофона (Firefox ESR)
     * Отправляет сырые PCM данные через MessagePort (AudioData создаётся в основном потоке)
     */
    class AudioRecorderProcessor extends AudioWorkletProcessor {
        constructor(options) {
            super();
            const opt = options?.processorOptions || {};
            this.channels = opt.channels || 2;
            this.frameSize = opt.frameSize || 1024;
            this.capacity = Math.max(this.frameSize * 4, 4096);
            this.bufferedFrames = 0;
            this.buffers = Array.from({ length: this.channels }, () => new Float32Array(this.capacity));
            this.prevInput = new Float32Array(this.channels);
            this.prevOutput = new Float32Array(this.channels);
        }

        process(inputs, outputs) {
            const input = inputs[0];
            if (!input || !input[0]) return true;

            const inputChannels = Math.min(input.length, this.channels);
            const blockFrames = input[0].length;

            if (this.bufferedFrames + blockFrames > this.capacity) {
                const overflow = this.bufferedFrames + blockFrames - this.capacity;
                for (let ch = 0; ch < this.channels; ch++) {
                    this.buffers[ch].copyWithin(0, overflow, this.bufferedFrames);
                }
                this.bufferedFrames -= overflow;
            }

            for (let ch = 0; ch < this.channels; ch++) {
                const src = input[Math.min(ch, inputChannels - 1)];
                if (!src) continue;
                this.buffers[ch].set(src, this.bufferedFrames);
            }
            this.bufferedFrames += blockFrames;

            while (this.bufferedFrames >= this.frameSize) {
                const channelData = [];
                for (let ch = 0; ch < this.channels; ch++) {
                    const chunk = new Int16Array(this.frameSize);
                    const src = this.buffers[ch];
                    for (let i = 0; i < this.frameSize; i++) {
                        // Remove DC bias from Safari mic capture before Opus encode.
                        const x = src[i];
                        const y = x - this.prevInput[ch] + 0.995 * this.prevOutput[ch];
                        this.prevInput[ch] = x;
                        this.prevOutput[ch] = y;
                        const s = Math.max(-1, Math.min(1, y));
                        chunk[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    channelData.push(chunk);
                }

                const remaining = this.bufferedFrames - this.frameSize;
                if (remaining > 0) {
                    for (let ch = 0; ch < this.channels; ch++) {
                        this.buffers[ch].copyWithin(0, this.frameSize, this.bufferedFrames);
                    }
                }
                this.bufferedFrames = remaining;

                this.port.postMessage({
                    type: 'audio-pcm-s16',
                    channelData: channelData,
                    numberOfChannels: this.channels,
                    numberOfFrames: this.frameSize
                }, channelData.map((chunk) => chunk.buffer));
            }

            return true;
        }
    }

    registerProcessor('audio-recorder-processor', AudioRecorderProcessor);

    /**
     * AudioLevelProcessor - lightweight local VAD source for browsers that do
     * not expose a usable RTCAudioSourceStats.audioLevel (notably Firefox).
     * It emits one RMS number and never transfers microphone PCM.
     */
    class AudioLevelProcessor extends AudioWorkletProcessor {
        constructor(options) {
            super();
            const opt = options?.processorOptions || {};
            this.reportSamples = Math.max(128, Number(opt.reportSamples || 960));
            this.sumSquares = 0;
            this.sampleCount = 0;
            this.frameCount = 0;
        }

        process(inputs, outputs) {
            const output = outputs[0];
            if (output) {
                for (const channel of output) channel.fill(0);
            }

            const input = inputs[0];
            if (!input || !input[0]) return true;
            const blockFrames = input[0].length;
            for (const channel of input) {
                if (!channel) continue;
                for (let i = 0; i < channel.length; i++) {
                    const sample = channel[i];
                    this.sumSquares += sample * sample;
                    this.sampleCount += 1;
                }
            }
            this.frameCount += blockFrames;

            if (this.frameCount >= this.reportSamples) {
                const rms = this.sampleCount > 0
                    ? Math.sqrt(this.sumSquares / this.sampleCount)
                    : 0;
                this.port.postMessage({ type: 'audio-level', rms });
                this.sumSquares = 0;
                this.sampleCount = 0;
                this.frameCount = 0;
            }
            return true;
        }
    }

    registerProcessor('audio-level-processor', AudioLevelProcessor);
}
