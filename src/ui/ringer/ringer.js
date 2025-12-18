// src/ui/ringer/ringer.js
import { RingType } from './ring_type.js';

const DEFAULT_PRESETS = {
    [RingType.CallIn]: { file: 'call_in.mp3', loop: true },
    [RingType.CallOut]: { file: 'call_out.mp3', loop: true },

    [RingType.ScheduleConnectQuick]: { file: 'schedule_quick.mp3', loop: false },
    [RingType.ScheduleConnectLong]: { file: 'schedule_long.mp3', loop: false },

    [RingType.Dial]: { file: 'dial.mp3', loop: false },

    [RingType.Hangup]: { file: 'hangup.mp3', loop: false },
    [RingType.NewMessage]: { file: 'new_message.mp3', loop: false },

    [RingType.SoundCheck]: { file: 'sound_check.mp3', loop: false },
};

export class Ringer {
    /**
     * @param {object} opts
     * @param {string} [opts.baseUrl='/sounds'] - где лежат файлы
     * @param {number} [opts.volume=1.0]
     * @param {object} [opts.presets] - переопределение DEFAULT_PRESETS
     */
    constructor(opts = {}) {
        const appUrl = new URL('.', window.location.href).href;
        this._baseUrl = appUrl + opts.baseUrl ?? '/sounds';
        this._volume = typeof opts.volume === 'number' ? opts.volume : 1.0;
        this._presets = { ...DEFAULT_PRESETS, ...(opts.presets || {}) };

        // runtime
        this._unlocked = false;
        this._ctx = null;
        this._gain = null;

        this._currentType = null;
        this._currentEl = null;     // HTMLAudio fallback
        this._currentSrc = null;    // AudioBufferSourceNode if we go WebAudio later
        this._repeatTimer = null;

        this._muted = false;

        // На мобилках автоплей банят — делаем "unlock-once"
        this._bindAutoUnlock();
    }

    setMuted(muted) { this._muted = !!muted; if (this._muted) this.Stop(); }
    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, Number(v) || 0));
        if (this._gain) this._gain.gain.value = this._volume;
        if (this._currentEl) this._currentEl.volume = this._volume;
    }

    async unlock() {
        if (this._unlocked) return true;

        // WebAudio unlock (если доступно)
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                this._ctx = this._ctx || new AC();
                if (this._ctx.state !== 'running') await this._ctx.resume();

                this._gain = this._gain || this._ctx.createGain();
                this._gain.gain.value = this._volume;
                this._gain.connect(this._ctx.destination);

                // "тихий" тик, чтобы iOS точно проснулся
                const osc = this._ctx.createOscillator();
                const g = this._ctx.createGain();
                g.gain.value = 0.00001;
                osc.connect(g).connect(this._ctx.destination);
                osc.start();
                osc.stop(this._ctx.currentTime + 0.02);

                this._unlocked = true;
                return true;
            }
        } catch {
            // ок, будет fallback на HTMLAudio
        }

        // HTMLAudio как минимум будет работать после gesture
        this._unlocked = true;
        return true;
    }

    Ring(ringType) {
        if (this._muted) return;

        const preset = this._presets[ringType];
        if (!preset) {
            console.warn('[Ringer] Unknown ring type:', ringType);
            return;
        }

        // правило: один звук за раз
        this.Stop();

        this._currentType = ringType;

        // если есть repeatMs — делаем периодический one-shot
        if (preset.repeatMs && preset.repeatMs > 0) {
            this._playOnce(preset, ringType);
            this._repeatTimer = setInterval(() => this._playOnce(preset, ringType), preset.repeatMs);
            return;
        }

        // иначе — loop/oneshot
        this._playLoopOrOnce(preset, ringType);
    }

    Stop() {
        this._currentType = null;

        if (this._repeatTimer) {
            clearInterval(this._repeatTimer);
            this._repeatTimer = null;
        }

        // WebAudio source (если будем включать)
        if (this._currentSrc) {
            try { this._currentSrc.stop(0); } catch { }
            try { this._currentSrc.disconnect(); } catch { }
            this._currentSrc = null;
        }

        // HTMLAudio
        if (this._currentEl) {
            try {
                this._currentEl.pause();
                this._currentEl.currentTime = 0;
            } catch { }
            this._currentEl = null;
        }
    }

    // ---------------- private ----------------

    _url(file) {
        const base = this._baseUrl.replace(/\/+$/, '');
        return `${base}/${file}`;
    }

    _playLoopOrOnce(preset, ringType) {
        // Для простоты и надёжности (особенно на мобилках) — HTMLAudio.
        // WebAudio можно включить позже, если понадобится микширование/эффекты.
        this._playHTMLAudio(preset, ringType, { loop: !!preset.loop });
    }

    _playOnce(preset, ringType) {
        this._playHTMLAudio(preset, ringType, { loop: false });
    }

    _playHTMLAudio(preset, ringType, { loop }) {
        const el = new Audio(this._url(preset.file));
        el.loop = loop;
        el.volume = this._volume;

        // важный момент: Stop() должен прибить текущий инстанс
        this._currentEl = el;

        // play может быть зареджектен до unlock/gesture — игнорим, не падаем
        const p = el.play();
        if (p && typeof p.catch === 'function') {
            p.catch((e) => {
                // если пока не unlocked — не шумим в логах
                if (!this._unlocked) return;
                console.warn('[Ringer] play rejected:', ringType, e?.name || e);
            });
        }
    }

    _bindAutoUnlock() {
        // один жест — и аудио будет работать дальше
        const once = async () => { try { await this.unlock(); } catch { } };
        window.addEventListener('pointerdown', once, { once: true, passive: true });
        window.addEventListener('touchstart', once, { once: true, passive: true });
        window.addEventListener('keydown', once, { once: true });
    }
}
