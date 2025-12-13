/**
 * mic_processor.js - microphone worklet
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

class MicChunker extends AudioWorkletProcessor {
    constructor({ processorOptions }) {
        super();
        this.channels = processorOptions?.channels ?? 1;
        this.frameSamples = processorOptions?.frameSamples ?? 1920; // 40ms @ 48k
        this.buffers = Array.from({ length: this.channels }, () => new Float32Array(0));
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        // 1) накапливаем
        for (let ch = 0; ch < this.channels; ch++) {
            const chunk = input[ch] || input[0]; // fallback mono→все каналы
            if (!chunk || chunk.length === 0) continue;

            const old = this.buffers[ch];
            const merged = new Float32Array(old.length + chunk.length);
            merged.set(old, 0);
            merged.set(chunk, old.length);
            this.buffers[ch] = merged;
        }

        // 2) выдаём по 40мс
        while (this.buffers[0].length >= this.frameSamples) {
            const outViews = new Array(this.channels);
            for (let ch = 0; ch < this.channels; ch++) {
                const src = this.buffers[ch];
                // берем «кусок»
                const sliceView = src.subarray(0, this.frameSamples);
                // ВАЖНО: копия в новый буфер, чтобы transfer не детачил накопитель
                const copy = new Float32Array(this.frameSamples);
                copy.set(sliceView);
                outViews[ch] = copy;

                // отрезаем хвост (останется на исходном буфере, который мы НЕ трансферим)
                this.buffers[ch] = src.subarray(this.frameSamples);
            }

            // отправляем копии; трансферим их буфера (это безопасно)
            this.port.postMessage(
                { type: 'pcm', frames: this.frameSamples, channels: outViews },
                outViews.map(v => v.buffer)
            );
        }

        return true;
    }
}

registerProcessor('mic-chunker', MicChunker);
