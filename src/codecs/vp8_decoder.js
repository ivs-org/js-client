/**
 * vp8_decoder.js - Video decoder
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export class VP8Decoder {
    constructor(onDecoderError) {
        this._lastFrame = null;
        this._errorCount = 0;
        this._lastForceTime = 0;

        this.onDecoderError = onDecoderError; // callback, например => mediaChannel.sendForceKeyFrame()

        this.decoder = new VideoDecoder({
            output: frame => { this._lastFrame = frame; },
            error: e => this._handleError(e)
        });

        try {
            this.decoder.configure({ codec: 'vp8' });
        } catch (e) {
            console.warn('configure decoder failed', e);
        }
    }

    _handleError(e) {
        console.error('video decoder error', e);
        this._errorCount++;

        const now = performance.now();

        // если подряд несколько ошибок или давно не было кейфрейма — шлем запрос
        if (this.onDecoderError && (this._errorCount > 2 || now - this._lastForceTime > 5000)) {
            this._lastForceTime = now;
            this._errorCount = 0;
            this.onDecoderError(); // 🔥 вызвать Force Key Frame
        }
    }

    async decode(encodedUint8) {
        if (!this.decoder || this.decoder.state === 'closed') return null;

        const chunk = new EncodedVideoChunk({
            type: 'key', // пусть пока все key, не мешает
            timestamp: performance.now() * 1000,
            data: encodedUint8
        });

        try {
            this.decoder.decode(chunk);
        } catch (e) {
            this._handleError(e);
            return null;
        }

        return new Promise((resolve) => {
            const iv = setInterval(() => {
                if (this._lastFrame) {
                    const f = this._lastFrame;
                    this._lastFrame = null;
                    clearInterval(iv);
                    this._errorCount = 0; // успешно — сбрасываем ошибки
                    resolve(f);
                }
            }, 2);

            setTimeout(() => {
                clearInterval(iv);
                resolve(null);
            }, 2000);
        });
    }
}
