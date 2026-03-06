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
        constructor() {
            super();
            this.buffer = [];
            this.channels = 2;
            this.frameSize = 1024; // размер кадра для отправки
        }

        process(inputs, outputs) {
            const input = inputs[0];
            if (!input || !input[0]) return true;

            // Сохраняем данные в буфер
            for (let ch = 0; ch < input.length; ch++) {
                if (!this.buffer[ch]) this.buffer[ch] = [];
                this.buffer[ch].push(...input[ch]);
            }

            // Когда набралось достаточно данных — отправляем
            if (this.buffer[0] && this.buffer[0].length >= this.frameSize) {
                const numChannels = Math.min(this.buffer.length, this.channels);
                const frames = this.buffer[0].length;

                // Отправляем сырые данные (AudioData создаётся в основном потоке)
                const channelData = [];
                for (let ch = 0; ch < numChannels; ch++) {
                    channelData.push(this.buffer[ch].splice(0, frames));
                }

                this.port.postMessage({
                    type: 'audio-pcm',
                    channelData: channelData,
                    numberOfChannels: numChannels,
                    numberOfFrames: frames
                });
            }

            return true;
        }
    }

    registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
}
