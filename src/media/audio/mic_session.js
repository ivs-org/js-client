/**
 * mic_session.js - microphone session
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import {
    parseMediaFrame,
    MediaType,
    makeRtp12,
    concatU8,
    importAesGcmKey,
    buildMediaFrame,
    gcmEncrypt,
    makeIvGcm,
} from '../../transport/rtp_wsm_utils.js';

import { Storage } from '../../data/storage.js';
import { AudioShared } from '../audio/audio_shared.js';
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class MicSession {
    constructor({
        bitrate = 32000,
        sampleRate = 48000,
        channels = 2,
        payloadType = 96,
        vad = {
            enabled: true,
            startLevel: 0.02,
            hysteresis: 0.003,
            endLevel: 0.015,
            startHoldMs: 120,
            endHoldMs: 450,
            smooth: 0.85,
            levelBoost: 3.0,
            tickMs: 50,
        },
    } = {}) {
        // remote meta
        this.server = null;
        this.token = null;
        this.deviceId = 0;
        this.ssrc = 0;
        this.port = 0;
        this.keyHex = '';

        // ws/crypto/encoder
        this.ws = null;
        this.aesKey = null;
        this.encoder = null;
        this._canEncode = false;
        this._shouldRunRemote = false;

        // local capture
        this._stream = null;
        this._track = null;
        this._processor = null;
        this._reader = null;
        this._pendingFirst = null;

        this.sampleRate = sampleRate;
        this.channels = channels;
        this.bitrate = bitrate;
        this.payloadType = payloadType | 0;

        // rtp state
        this._seq = 0;
        this._pt = 111;
        this._ts = 0;

        // send chain (чтобы не гнать в сеть параллельно)
        this._sendChain = Promise.resolve();

        // state
        this._closing = false;
        this._localRunning = false;

        // events
        this._handlers = {};

        // VAD via WebAudio
        this._vad = { ...vad };
        this._ac = null;
        this._source = null;
        this._analyser = null;
        this._time = null;
        this._vadTimer = 0;

        this._level = 0;
        this._speaking = false;
        this._aboveSince = 0;
        this._belowSince = 0;
    }

    // --- events ---
    on(name, fn) {
        if (!this._handlers[name]) this._handlers[name] = new Set();
        this._handlers[name].add(fn);
        return () => this.off(name, fn);
    }
    off(name, fn) {
        const s = this._handlers[name];
        if (!s) return;
        s.delete(fn);
        if (!s.size) delete this._handlers[name];
    }
    _emit(name, payload) {
        const s = this._handlers[name];
        if (!s) return;
        for (const fn of s) {
            try { fn(payload); } catch (e) { console.warn('[MicSession] handler error', name, e); }
        }
    }

    getCaptureInfo() {
        return { sampleRate: this.sampleRate, channels: this.channels, bitrate: this.bitrate };
    }

    // 1) Локальный старт (если тут ошибка — сервер не трогаем)
    async startLocalCapture() {
        if (this._localRunning) return this.getCaptureInfo();

        this._localRunning = true;
        this._closing = false;

        const micId = (Storage.getSetting && Storage.getSetting('media.micDeviceId', '')) || '';

        const audio = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        };
        if (micId) audio.deviceId = { exact: micId };

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
        } catch (e) {
            if (micId) {
                console.warn('🎙️ selected mic failed, fallback to default:', e?.name || e);
                delete audio.deviceId;
                this._stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
            } else {
                throw e;
            }
        }

        this._track = this._stream.getAudioTracks()[0];
        if (!this._track) {
            await this.stop();
            throw new Error('No audio track');
        }

        // VAD на shared AudioContext (без вывода в колонки)
        if (this._vad.enabled) {
            this._startVad(this._stream);
        }

        // TrackProcessor / reader (для WebCodecs AudioEncoder)
        this._processor = new MediaStreamTrackProcessor({ track: this._track });
        this._reader = this._processor.readable.getReader();

        // первый AudioData — чтобы узнать фактический формат
        const first = await this._reader.read();
        if (first.done || !first.value) {
            await this.stop();
            throw new Error('[Mic] No audio frames');
        }

        const firstAudio = first.value;
        this._pendingFirst = firstAudio;

        this.sampleRate = firstAudio.sampleRate || this.sampleRate || 48000;
        this.channels = firstAudio.numberOfChannels || this.channels || 1;

        this._track.onended = () => { this.stop().catch(() => { }); };

        this._pumpFrames();

        console.log(`🎙️ Mic local capture started: ${this.sampleRate}Hz ch=${this.channels}`);
        return this.getCaptureInfo();
    }

    async restartCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this._closing) return;
        await this._stopLocalCapture();
        await this.startLocalCapture();
    }

    // 2) Remote attach (после успешного локального старта)
    async attachRemote({ server, token, deviceId, ssrc, port, keyHex }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.port = port;
        this.keyHex = (keyHex || '').trim();

        this._shouldRunRemote = true;

        if (!this._localRunning) {
            console.warn('[Mic] attachRemote called before local capture; ignoring');
            return;
        }

        if (!this.aesKey && this.keyHex) {
            this.aesKey = await importAesGcmKey(this.keyHex);
        }

        if (!this.encoder) {
            const cfg = {
                codec: 'opus',
                sampleRate: this.sampleRate,
                numberOfChannels: this.channels,
                bitrate: this.bitrate,
            };

            const sup = await AudioEncoder.isConfigSupported(cfg).catch(() => null);
            if (sup && !sup.supported) console.warn('[Mic] Opus config not supported, trying anyway', sup);

            this.encoder = new AudioEncoder({
                output: (chunk, meta) => this._onEncoded(chunk, meta),
                error: (e) => console.error('[Mic] encoder error', e),
            });
            this.encoder.configure(cfg);
        }

        await this._connectWS();
    }

    async stop() {
        this._shouldRunRemote = false;
        this._canEncode = false;

        // ws
        try {
            this.ws?.send(JSON.stringify({ disconnect: {} }));
            this.ws?.close();
        } catch { }
        this.ws = null;

        // encoder
        if (this.encoder) {
            try { await this.encoder.flush().catch(() => { }); } catch { }
            try { this.encoder.close(); } catch { }
            this.encoder = null;
        }

        await this._stopLocalCapture();

        console.log('🎙️ MicSession stopped');
    }

    async _stopLocalCapture() {
        this._closing = true;
        this._localRunning = false;

        this._stopVad();

        if (this._pendingFirst) {
            try { this._pendingFirst.close(); } catch { }
            this._pendingFirst = null;
        }

        try { await this._reader?.cancel(); } catch { }
        this._reader = null;
        this._processor = null;

        if (this._track) { try { this._track.stop(); } catch { } }
        this._track = null;

        if (this._stream) { try { this._stream.getTracks().forEach(t => t.stop()); } catch { } }
        this._stream = null;
    }

    async _connectWS() {
        if (!this.server || !this.token) throw new Error('[Mic] server/token not set');

        return new Promise((resolve) => {
            this.ws = new WebSocket(this.server);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.ws.send(JSON.stringify({
                    connect_request: { channel_type: 1 /* wsm */, access_token: this.token },
                }));
            };

            this.ws.onmessage = async (ev) => {
                if (typeof ev.data === 'string') {
                    let msg; try { msg = JSON.parse(ev.data); } catch { }
                    if (msg?.connect_response) {
                        this._canEncode = true;
                        return resolve();
                    }
                    if (ev.data.includes('ping')) this.ws?.send(JSON.stringify({ ping: {} }));
                    return;
                }

                const frm = parseMediaFrame(ev.data);
                if (!frm) return;
                if (frm.mediaType === MediaType.RTCP) {
                    // для uplink аудио обычно можно игнорировать
                }
            };

            this.ws.onclose = () => { this._canEncode = false; };
            this.ws.onerror = (e) => { console.warn('[Mic] ws error', e); };
        });
    }

    async _pumpFrames() {
        while (!this._closing) {
            let audioData = null;
            try {
                if (this._pendingFirst) {
                    audioData = this._pendingFirst;
                    this._pendingFirst = null;
                } else {
                    const r = await this._reader.read();
                    if (r.done || !r.value) break;
                    audioData = r.value;
                }

                if (this._canEncode && this.encoder) {
                    this.encoder.encode(audioData);
                }
            } catch (e) {
                console.warn('[Mic] pump/encode error', e);
            } finally {
                try { audioData?.close(); } catch { }
            }
        }
    }

    async _onEncoded(payload/*EncodedAudioChunk*/, meta) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const buf = new ArrayBuffer(payload.byteLength);
        payload.copyTo(new Uint8Array(buf));

        this._seq = (this._seq + 1) & 0xffff;
        const rtp12 = makeRtp12(this._pt, this._seq, this._ts, this.ssrc);
        let wire;

        if (this.aesKey) {
            const iv = makeIvGcm(this.ssrc, this._ts, this._seq);

            // opusBytes: Uint8Array из EncodedAudioChunk
            const cipherTag = await gcmEncrypt(this.aesKey, iv, rtp12, buf);

            // RTP(12) + cipher||tag
            wire = concatU8(rtp12, cipherTag);
        }
        else {
            wire = concatU8(rtp12, new Uint8Array(buf));
        }

        const frame = buildMediaFrame(this.ssrc, this.port, MediaType.RTP, wire);
        this.ws.send(frame);
    }

    // -------- VAD via AnalyserNode (без copyTo) --------

    _startVad(stream) {
        this._stopVad();

        this._ac = AudioShared.ensureContext();
        // на мобилках может быть suspended до user gesture
        if (this._ac.state !== 'running') {
            this._ac.resume().catch(() => { });
        }

        this._source = this._ac.createMediaStreamSource(stream);
        this._analyser = this._ac.createAnalyser();
        this._analyser.fftSize = 1024;
        this._analyser.smoothingTimeConstant = 0.8;

        this._source.connect(this._analyser);

        this._time = new Uint8Array(this._analyser.fftSize);

        const tick = Math.max(20, this._vad.tickMs || 50);
        this._vadTimer = setInterval(() => this._vadTick(), tick);
    }

    _stopVad() {
        if (this._vadTimer) clearInterval(this._vadTimer);
        this._vadTimer = 0;

        if (this._source) { try { this._source.disconnect(); } catch { } }
        this._source = null;

        this._analyser = null;
        this._time = null;

        // AudioContext shared — НЕ закрываем
        this._ac = null;

        this._level = 0;
        this._aboveSince = 0;
        this._belowSince = 0;
    }

    _vadTick() {
        const a = this._analyser;
        if (!a || !this._time) return;

        a.getByteTimeDomainData(this._time);

        // RMS 0..1 по Uint8
        let sum = 0;
        for (let i = 0; i < this._time.length; i++) {
            const v = (this._time[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / this._time.length);

        const level = clamp01(rms * (this._vad.levelBoost || 1));
        const smooth = this._vad.smooth ?? 0.85;
        this._level = this._level * smooth + level * (1 - smooth);

        const now = performance.now();
        const startLevel = this._vad.startLevel ?? 0.02;

        const startTh = this._vad.startLevel ?? 0.020;
        const hyst = this._vad.hysteresis ?? 0.003;
        const endLevel = Math.max(0, startTh - hyst);

        const startHold = this._vad.startHoldMs ?? 120;
        const endHold = this._vad.endHoldMs ?? 450;

        if (!this._speaking) {
            if (this._level >= startLevel) {
                if (!this._aboveSince) this._aboveSince = now;
                if (now - this._aboveSince >= startHold) {
                    this._speaking = true;
                    this._belowSince = 0;
                    this._emit('speak_started', { level: this._level });
                }
            } else {
                this._aboveSince = 0;
            }
            return;
        }

        // speaking==true
        if (this._level <= endLevel) {
            if (!this._belowSince) this._belowSince = now;
            if (now - this._belowSince >= endHold) {
                this._speaking = false;
                this._aboveSince = 0;
                this._emit('speak_ended', { level: this._level });
            }
        } else {
            this._belowSince = 0;
        }
    }
}
