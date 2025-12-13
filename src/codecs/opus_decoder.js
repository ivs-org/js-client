/**
 * opus_decoder.js - Audio decoder
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export class OpusDecoder {
    constructor(_onDecodedAudio) {
        this._onDecodedAudio = _onDecodedAudio;

        try {
            this.decoder = new AudioDecoder({
                output: frame => { this._onDecodedAudio(frame); },
                error: e => { console.warn(`opus decoder err: ${e}`); }
            });

            this.decoder.configure({
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 2
            });
        } catch (e) {
            console.warn("AudioDecoder configure failed", e);
        }
    }

    decode(encodedFrame) {
        if (!this.decoder || this.decoder.state === "closed") return null;

        const chunk = new EncodedAudioChunk({
            type: "key",
            timestamp: performance.now() * 1000,
            data: encodedFrame
        });

        try {
            this.decoder.decode(chunk);
        } catch (e) {
            console.warn(`opus decoder err: ${e}`);
            return null;
        }
    }
}
