// src/ui/monitor/mic_monitor.js

export class MicMonitor {
    constructor() {
        this._canvas = null;
        this._ctx2d = null;

        this._stream = null;
        this._ac = null;
        this._source = null;
        this._analyser = null;

        this._time = null;
        this._raf = 0;

        this._level = 0;          // 0..1
        this._smooth = 0.85;      // сглаживание уровня

        this._scopeGain = 0.75;   // чувствительность осциллографа (меньше = спокойнее)
        this._deadZone = 0.02;
    }

    setCanvas(canvas) {
        this._canvas = canvas || null;
        this._ctx2d = this._canvas ? this._canvas.getContext('2d') : null;
    }

    get isRunning() { return !!this._stream; }

    async start({ deviceId = '' } = {}) {
        await this.stop();

        // 1) получаем поток
        const audio = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        };
        if (deviceId) audio.deviceId = { exact: deviceId };

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio });
        } catch (e) {
            if (deviceId) {
                // fallback на default
                delete audio.deviceId;
                stream = await navigator.mediaDevices.getUserMedia({ audio });
            } else {
                throw e;
            }
        }

        this._stream = stream;

        // 2) WebAudio
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('AudioContext недоступен');

        this._ac = new AC();
        if (this._ac.state !== 'running') {
            // на мобилках может потребоваться user gesture; кнопка "Старт" это и даст
            await this._ac.resume().catch(() => { });
        }

        this._source = this._ac.createMediaStreamSource(stream);
        this._analyser = this._ac.createAnalyser();
        this._analyser.fftSize = 2048;
        this._analyser.smoothingTimeConstant = 0.8;

        this._source.connect(this._analyser);

        this._time = new Uint8Array(this._analyser.fftSize);

        this._loop();
    }

    async stop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;

        if (this._source) { try { this._source.disconnect(); } catch { } }
        this._source = null;

        this._analyser = null;
        this._time = null;

        if (this._ac) { try { await this._ac.close(); } catch { } }
        this._ac = null;

        if (this._stream) {
            try { this._stream.getTracks().forEach(t => t.stop()); } catch { }
        }
        this._stream = null;

        this._level = 0;
        this._renderIdle();
    }

    _loop() {
        this._raf = requestAnimationFrame(() => this._loop());
        this._render();
    }

    _renderIdle() {
        const c = this._canvas, g = this._ctx2d;
        if (!c || !g) return;
        const w = c.width | 0, h = c.height | 0;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillRect(0, 0, w, h);
    }

    _render() {
        const c = this._canvas, g = this._ctx2d, a = this._analyser;
        if (!c || !g || !a) return;

        const w = c.width | 0, h = c.height | 0;
        if (w < 2 || h < 2) return;

        a.getByteTimeDomainData(this._time);

        // RMS level 0..1
        let sum = 0;
        for (let i = 0; i < this._time.length; i++) {
            const v = (this._time[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / this._time.length);
        this._level = this._level * this._smooth + rms * (1 - this._smooth);

        // фон
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);

        // уровень (полоска)
        const barH = 10;
        g.fillStyle = '#111';
        g.fillRect(0, h - barH, w, barH);
        g.fillStyle = '#38bdf8';
        g.fillRect(0, h - barH, Math.floor(w * Math.min(1, this._level * 3)), barH);

        // осциллограф
        g.strokeStyle = '#e5e7eb';
        g.lineWidth = 1;

        g.beginPath();
        const mid = (h - barH) * 0.5;
        const amp = (h - barH) * 0.45;
        for (let i = 0; i < this._time.length; i++) {
            const x = (i / (this._time.length - 1)) * w;

            let v = (this._time[i] - 128) / 128;
            // dead-zone: гасим микрофонный “ноль”, чтобы не мерцал
            if (Math.abs(v) < this._deadZone) v = 0;
            // уменьшаем чувствительность
            v *= this._scopeGain;

            const y = mid + v * amp;

            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.stroke();
    }
}
