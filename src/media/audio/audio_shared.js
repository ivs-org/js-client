/**
 * audio_shared.js - Playback worklet
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export const AudioShared = {
    ctx: null,
    workletReady: null,
    _unlockBound: false,

    ensureContext() {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });    

            this._bindUnlock();
            this._bindStateWatch();
        }

        return this.ctx;
    },

    _bindUnlock() {
        if (this._unlockBound) return;
        this._unlockBound = true;

        const tryResume = () => {
            const ctx = this.ctx;
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                // важно: без await, чтобы не потерять user-gesture контекст
                ctx.resume().catch(() => { });
            }
        };

        window.addEventListener('pointerdown', tryResume, { passive: true });
        window.addEventListener('touchstart', tryResume, { passive: true });
        window.addEventListener('keydown', tryResume);
        window.addEventListener('focus', tryResume);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) tryResume();
        });
    },

    _bindStateWatch() {
        const ctx = this.ctx;
        if (!ctx || ctx._vgStateWatch) return;
        ctx._vgStateWatch = true;

        ctx.addEventListener('statechange', () => {
            // иногда после включения mic контекст уходит в suspended — попробуем тут же вернуть
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => { });
            }
        });
    },

    // вызывается строго из обработчика клика/жеста пользователя
    kickFromGesture() {
        const ctx = this.ensureContext();
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });

        // короткая "доводка"": иногда suspension случается почти сразу после жеста
        queueMicrotask(() => {
            if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        });
        requestAnimationFrame(() => {
            if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        });
    },

    async ensureWorklet() {
        if (this.workletReady) return this.workletReady;
        const ctx = this.ensureContext();

        const url = new URL('.', window.location.href).href
            + '/src/media/audio/audio_processor.js';
        
        this.workletReady = ctx.audioWorklet.addModule(url)
            .then(() => console.log('✅ audio worklet preloaded'))
            .catch(err => {
                console.error('❌ audio worklet load failed:', err);
                this.workletReady = null;
                throw err;
            });
        return this.workletReady;
    },

    async setOutputDevice(deviceId) {
        const ctx = this.ensureContext();

        if (typeof ctx.setSinkId !== 'function') {
            // iOS/Safari и часть браузеров не поддерживают
            return false;
        }

        const sinkId = (deviceId && String(deviceId).length) ? String(deviceId) : 'default';

        try {
            await ctx.setSinkId(sinkId);
            console.log('🔊 Audio output device set:', sinkId);
            return true;
        } catch (e) {
            console.warn('🔊 setSinkId failed:', e?.name || e, sinkId);
            return false;
        }
    }
};
