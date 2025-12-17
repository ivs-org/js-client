// src/ui/screen_wake_lock.js

export const ScreenWakeLock = {
    _enabled: false,     // хотим держать экран бодрым (в звонке)
    _sentinel: null,     // WakeLockSentinel
    _bound: false,

    isSupported() {
        return !!(navigator.wakeLock && typeof navigator.wakeLock.request === 'function');
    },

    async enable() {
        this._enabled = true;
        this._bind();
        return await this._acquire();
    },

    async disable() {
        this._enabled = false;
        await this._releaseOnly();
    },

    async _acquire() {
        if (!this._enabled) return false;
        if (!this.isSupported()) return false;
        if (document.hidden) return false;
        if (this._sentinel) return true;

        try {
            // 'screen' — основной режим; request возвращает WakeLockSentinel :contentReference[oaicite:2]{index=2}
            this._sentinel = await navigator.wakeLock.request('screen');

            this._sentinel.addEventListener('release', () => {
                // Браузер может сам релизнуть (фон/система). Мы просто отмечаем и попробуем вернуть при необходимости.
                this._sentinel = null;
                if (this._enabled && !document.hidden) {
                    this._acquire().catch(() => { });
                }
            });

            return true;
        } catch (e) {
            // отказ/неподдержка/политики энергосбережения — не критично для звонка
            this._sentinel = null;
            console.debug('[WakeLock] request failed:', e?.name || e);
            return false;
        }
    },

    async _releaseOnly() {
        const s = this._sentinel;
        this._sentinel = null;
        if (!s) return;
        try { await s.release(); } catch { }
    },

    _bind() {
        if (this._bound) return;
        this._bound = true;

        // Wake lock обычно сбрасывается при уходе вкладки в фон -> по возвращению ре-аквайрим :contentReference[oaicite:3]{index=3}
        document.addEventListener('visibilitychange', () => {
            if (!this._enabled) return;
            if (document.hidden) {
                this._releaseOnly();
            } else {
                this._acquire().catch(() => { });
            }
        });

        // при выгрузке страницы — гарантированный release
        window.addEventListener('pagehide', () => {
            this._releaseOnly();
        });
    }
};
