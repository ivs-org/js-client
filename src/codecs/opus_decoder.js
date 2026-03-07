/**
 * opus_decoder.js - Audio decoder
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { setAudioDebugStatus } from '../core/app_state.js';

export class OpusDecoder {
    constructor(_onDecodedAudio) {
        this._onDecodedAudio = _onDecodedAudio;
        this.decodeCount = 0;
        this.errorCount = 0;

        const hasAudioDecoder = 'AudioDecoder' in window;
        
        setAudioDebugStatus(`🔍 AudioDecoder: ${hasAudioDecoder ? '✓' : '✗'}`);

        try {
            this.decoder = new AudioDecoder({
                output: frame => {
                    this.decodeCount++;
                    if (this.decodeCount === 1) {
                        setAudioDebugStatus('🎵 ✓ Звук декодируется');
                    } else if (this.decodeCount % 500 === 1) {
                        setAudioDebugStatus(`🎵 Декодировано кадров: ${this.decodeCount}`);
                    }
                    this._onDecodedAudio(frame);
                },
                error: e => {
                    this.errorCount++;
                    setAudioDebugStatus(`🔴 Ошибка декодера: ${e.message || e}`);
                }
            });

            this.decoder.configure({
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 2
            });

            setAudioDebugStatus('✅ Opus декодер готов');
        } catch (e) {
            setAudioDebugStatus(`❌ Ошибка AudioDecoder: ${e.message || e}`);
            this.decoder = null;
        }
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
            setAudioDebugStatus(`🔴 Ошибка при декодировании: ${e.message || e}`);
            return null;
        }
    }
}
