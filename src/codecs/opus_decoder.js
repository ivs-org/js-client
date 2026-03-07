/**
 * opus_decoder.js - Audio decoder
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export class OpusDecoder {
    constructor(_onDecodedAudio) {
        this._onDecodedAudio = _onDecodedAudio;
        this.decodeCount = 0;
        this.errorCount = 0;

        const hasAudioDecoder = 'AudioDecoder' in window;
        
        // Показываем статус в UI
        this._showAudioStatus(`🔍 AudioDecoder: ${hasAudioDecoder ? '✓' : '✗'}`);

        try {
            this.decoder = new AudioDecoder({
                output: frame => {
                    this.decodeCount++;
                    if (this.decodeCount === 1) {
                        this._showAudioStatus('🎵 ✓ Звук декодируется');
                    } else if (this.decodeCount % 500 === 1) {
                        this._showAudioStatus(`🎵 Декодировано кадров: ${this.decodeCount}`);
                    }
                    this._onDecodedAudio(frame);
                },
                error: e => {
                    this.errorCount++;
                    this._showAudioStatus(`🔴 Ошибка декодера: ${e.message || e}`);
                }
            });

            this.decoder.configure({
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 2
            });

            this._showAudioStatus('✅ Opus декодер готов');
        } catch (e) {
            this._showAudioStatus(`❌ Ошибка AudioDecoder: ${e.message || e}`);
            this.decoder = null;
        }
    }

    _showAudioStatus(msg) {
        console.log(msg);
        // Создаём или обновляем статус в UI
        let statusEl = document.getElementById('audio-status-debug');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'audio-status-debug';
            statusEl.style.cssText = `
                position: fixed;
                bottom: 10px;
                left: 10px;
                background: rgba(0,0,0,0.8);
                color: #0f0;
                padding: 10px;
                border-radius: 5px;
                font-size: 12px;
                z-index: 999999;
                max-width: 400px;
                white-space: pre-wrap;
            `;
            document.body.appendChild(statusEl);
        }
        statusEl.textContent = msg;
        
        // Убираем через 3 секунды
        setTimeout(() => {
            if (statusEl && statusEl.textContent === msg) {
                statusEl.textContent = '';
            }
        }, 3000);
    }

    close() {
       if (this.decoder) {
            try { this.decoder.close(); } catch { }
            this.decoder = null;
        }
    }

    decode(encodedFrame) {
        if (!this.decoder || this.decoder.state === "closed") {
            return null;
        }

        const chunk = new EncodedAudioChunk({
            type: "key",
            timestamp: performance.now() * 1000,
            data: encodedFrame
        });

        try {
            this.decodeCount++;
            this.decoder.decode(chunk);
        } catch (e) {
            this.errorCount++;
            this._showAudioStatus(`🔴 Ошибка при декодировании: ${e.message || e}`);
            return null;
        }
    }
}
