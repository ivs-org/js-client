/**
 * audio_shared.js - Playback worklet
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export const AudioShared = {
    ctx: null,
    workletReady: null,
    ensureContext() {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
            // первый пользовательский жест — resume
            window.addEventListener('click', async () => {
                if (this.ctx.state === 'suspended') await this.ctx.resume();
            }, { once: true });
        }
        return this.ctx;
    },
    ensureWorklet() {
        if (this.workletReady) return this.workletReady;
        const ctx = this.ensureContext();
        this.workletReady = ctx.audioWorklet.addModule('./src/media/audio/audio_processor.js')
            .then(() => console.log('✅ audio worklet preloaded'))
            .catch(err => {
                console.error('❌ audio worklet load failed:', err);
                this.workletReady = null; // позволим повторить позже
                throw err;
            });
        return this.workletReady;
    }
};
