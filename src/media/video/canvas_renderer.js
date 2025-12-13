// src/media/video/canvas_renderer.js

export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement|string|null} canvasOrId
     * @param {object} opts
     * @param {boolean} [opts.mirrorDefault=false]
     * @param {string}  [opts.clearColor='#000']
     * @param {boolean} [opts.autoDpr=false]        // подгонять canvas.width/height под CSS*DPR
     * @param {number}  [opts.maxPixels=2073600]    // 1920*1080 по умолчанию
     * @param {boolean} [opts.observeResize=false]  // ResizeObserver вместо опроса
     * @param {boolean} [opts.desynchronized=true]  // try request low-latency context
     */
    constructor(canvasOrId, opts = {}) {
        this._opts = {
            mirrorDefault: false,
            clearColor: '#000',
            autoDpr: false,
            maxPixels: 1920 * 1080,
            observeResize: false,
            desynchronized: true,
            ...opts,
        };

        this._canvas = null;
        this._ctx = null;

        this._cssW = 0;
        this._cssH = 0;

        this._ro = null;

        if (canvasOrId) this.setCanvas(canvasOrId);
    }

    setCanvas(canvasOrId) {
        const canvas = (typeof canvasOrId === 'string')
            ? document.getElementById(canvasOrId)
            : canvasOrId;

        if (!canvas) {
            this._canvas = null;
            this._ctx = null;
            this._stopObserve();
            return;
        }

        this._canvas = canvas;

        // Пытаемся получить более "low-latency" контекст (где поддерживается)
        const ctxOpts = this._opts.desynchronized
            ? { alpha: false, desynchronized: true }
            : { alpha: false };

        this._ctx = canvas.getContext('2d', ctxOpts) || canvas.getContext('2d');
        if (!this._ctx) {
            this._stopObserve();
            return;
        }

        if (this._opts.observeResize) this._startObserve();
        if (this._opts.autoDpr) this.syncBackingStore(); // разово
    }

    get canvas() { return this._canvas; }
    get ctx() { return this._ctx; }

    setOptions(partial) {
        Object.assign(this._opts, partial || {});
        if (this._opts.observeResize) this._startObserve();
        else this._stopObserve();
    }

    destroy() {
        this._stopObserve();
        this._canvas = null;
        this._ctx = null;
    }

    /**
     * Подгоняет canvas.width/height под clientSize*DPR (CSS размер не меняется)
     */
    syncBackingStore() {
        const canvas = this._canvas;
        if (!canvas) return;

        // Если есть ResizeObserver — он уже обновляет _cssW/_cssH
        if (!this._cssW || !this._cssH) {
            const r = canvas.getBoundingClientRect();
            this._cssW = Math.max(1, (r.width | 0));
            this._cssH = Math.max(1, (r.height | 0));
        }

        const dpr = window.devicePixelRatio || 1;

        let w = Math.max(2, Math.floor(this._cssW * dpr));
        let h = Math.max(2, Math.floor(this._cssH * dpr));

        // cap по пикселям (чтобы не улететь в 4K backing store)
        const maxPx = this._opts.maxPixels | 0;
        const px = w * h;
        if (maxPx > 0 && px > maxPx) {
            const k = Math.sqrt(maxPx / px);
            w = Math.max(2, Math.floor(w * k));
            h = Math.max(2, Math.floor(h * k));
        }

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    }

    /**
     * Рисует bitmap в canvas с сохранением пропорций (contain + letterbox),
     * опционально зеркалит.
     */
    drawBitmapContain(bitmap, { mirror = this._opts.mirrorDefault } = {}) {
        const canvas = this._canvas;
        const ctx = this._ctx;
        if (!canvas || !ctx || !bitmap) return;

        if (this._opts.autoDpr && !this._opts.observeResize) {
            // если без RO, можно подгонять occasionally; но для простоты — каждый draw
            this._cssW = canvas.clientWidth | 0;
            this._cssH = canvas.clientHeight | 0;
            this.syncBackingStore();
        }

        const cw = canvas.width | 0;
        const ch = canvas.height | 0;
        const sw = bitmap.width | 0;
        const sh = bitmap.height | 0;
        if (cw <= 1 || ch <= 1 || sw <= 1 || sh <= 1) return;

        // clear
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this._opts.clearColor;
        ctx.fillRect(0, 0, cw, ch);

        const sAR = sw / sh;
        const cAR = cw / ch;

        let dw, dh, dx, dy;
        if (sAR > cAR) {
            dw = cw;
            dh = Math.round(dw / sAR);
            dx = 0;
            dy = Math.round((ch - dh) / 2);
        } else {
            dh = ch;
            dw = Math.round(dh * sAR);
            dx = Math.round((cw - dw) / 2);
            dy = 0;
        }

        if (!mirror) {
            // обычный draw
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(bitmap, dx, dy, dw, dh);
        } else {
            // mirror по X без "съезда" положения: рисуем по скорректированному x
            ctx.setTransform(-1, 0, 0, 1, cw, 0);
            const mx = cw - dx - dw;
            ctx.drawImage(bitmap, mx, dy, dw, dh);
        }

        // не оставляем transform "залипшим"
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    _startObserve() {
        if (!this._canvas || this._ro) return;
        if (typeof ResizeObserver === 'undefined') return;

        this._ro = new ResizeObserver((entries) => {
            const e = entries && entries[0];
            if (!e) return;
            const cr = e.contentRect;
            this._cssW = Math.max(1, (cr.width | 0));
            this._cssH = Math.max(1, (cr.height | 0));

            if (this._opts.autoDpr) this.syncBackingStore();
        });

        this._ro.observe(this._canvas);
    }

    _stopObserve() {
        if (!this._ro) return;
        try { this._ro.disconnect(); } catch { }
        this._ro = null;
        this._cssW = 0;
        this._cssH = 0;
    }
}
