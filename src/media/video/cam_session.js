/**
 * cam_session.js - Camera session
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import {
    parseMediaFrame,
    WsBinaryMsgType,
    MediaType,
    importAesGcmKey,
} from '../../transport/rtp_wsm_utils.js';

import { RTPSplitter } from '../../transport/rtp_splitter.js';

function drawFrameToCanvas(frame, mirror = true) {
    let preview = document.getElementById('localPreview');
    if (!preview) return;

    const ctx = preview.getContext('2d');

    const width = preview.width;
    const height = preview.height;

    if (frame) {
        ctx.save();
        if (mirror) {                 // селфи-режим
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
        }
        // WebCodecs умеет рисовать VideoFrame напрямую
        ctx.drawImage(frame, 0, 0, width, height);
    }
    else {
        ctx.clearRect(0, 0, width, height);
    }
    ctx.restore();
}

export class CameraSession {
    constructor({
        server,             // base wss://...
        token,              // access_token на media-WS
        deviceId,           // из DEVICE_CONNECT (CreatedDevice)
        ssrc,               // author_ssrc
        port,               // dest port
        keyHex,             // 64 hex (32 bytes) AES-256-GCM ключ
        width,
        height
    }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.port = port;
        this.keyHex = keyHex.trim();
        
        // WS / crypto / encoder
        this.ws = null;
        this.encoder = null;
        this.aesKey = null;
        this.splitter = null;

        this._sendChain = Promise.resolve(); // сериализатор

        this.width = width;
        this.height = height;
        this.fps = 25;
        this.bitrate = 1_200_000;
        this._ts = 0;
        this._wantKeyframe = false;

        // media
        this._stream = null;
        this._track = null;
        this._processor = null;
        this._reader = null;

        // WS connection
        this._closing = false;
        this._shouldRun = false;       // хотим ли держать сессию активной
        this._reconning = false;       // сейчас идёт реконнект
        this._wsAttempts = 0;          // счётчик попыток
    }

    async start() {
        if (this._shouldRun) return;
        this._shouldRun = true;

        // Импорт AES ключа (однократно)
        if (!this.aesKey && this.keyHex) {
            this.aesKey = await importAesGcmKey(this.keyHex);
        }

        await this._connectWS();
        
        console.log(`📷 CameraSession started: ${this.width}x${this.height}@${this.fps}, br=${this.bitrate}`);
    }

    async stop() {
        this._shouldRun = false;
        await this._stopCapture();   // гасим захват/энкодер
        try { this.ws?.close(); } catch { }
        this.ws = null;
        this._reconning = false;     // обрываем будущие попытки
        this._wsAttempts = 0;
        console.log(`📷 CameraSession stopped`);
    }

    async _connectWS() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.server);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                // логон на media-WS
                this.ws.send(JSON.stringify({
                    connect_request: { channel_type: 1 /* wsm */, access_token: this.token }
                }));
            };

            this.ws.onmessage = async (ev) => {
                if (typeof ev.data === 'string') {
                    let msg; try { msg = JSON.parse(ev.data); } catch { }
                    if (msg?.connect_response) {
                        await this._startCapture();  // запустить камеру + encoder
                        return resolve();
                    }
                    if (ev.data.includes('ping')) this.ws?.send(JSON.stringify({ ping: {} }));
                    return;
                }

                const frm = parseMediaFrame(ev.data);
                if (!frm || frm.mediaType === MediaType.RTCP) {
                    this._wantKeyframe = true;
                    console.log("Cam key frame RTCP force");
                }
            };

            this.ws.onerror = (e) => {
                // мгновенно уйдём в onclose — там реконнект
                console.warn('[Cam] ws error', e);
            };

            this.ws.onclose = () => {
                if (!this._shouldRun) return; // нас попросили остановиться
                this._onWsDown();
            };
        });
    }

    _onWsDown() {
        this._stopCapture().catch(() => { });

        if (this._reconning) return;
        this._reconning = true;
        this._reconnectLoop(); // fire-and-forget
    }

    async _reconnectLoop() {
        while (this._shouldRun && this._reconning) {
            const delayMs = Math.min(10000, 500 * Math.pow(2, this._wsAttempts)); // 0.5..10с
            if (this._wsAttempts > 0) {
                await new Promise(r => setTimeout(r, delayMs));
            }
            this._wsAttempts++;

            try {
                await this._connectWS();
                // Успех: выходим
                this._reconning = false;
                console.log('[Cam] reconnected');
                return;
            } catch (e) {
                console.warn('[Cam] reconnect failed, retrying...', e);
                // цикл продолжится
            }
        }
    }

    async _startCapture() {
        if (this.encoder) return; // уже запущено

        // Поднимаем getUserMedia (видеокамера)
        this._stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: this.width },
                height: { ideal: this.height },
                frameRate: { ideal: this.fps },
                facingMode: 'user',
                resizeMode: 'crop-and-scale'
            },
            audio: false
        });

        this._track = this._stream.getVideoTracks()[0];
        if (!this._track) throw new Error('No video track');

        // MediaStreamTrackProcessor -> кадры в VideoEncoder
        this._processor = new MediaStreamTrackProcessor({ track: this._track });
        this._reader = this._processor.readable.getReader();

        this.splitter = new RTPSplitter({
            ssrc: this.ssrc,
            port: this.port,
            aesKey: this.aesKey,
            sendFn: (u8) => this._wsSend(u8)
        });

        // Настраиваем VP8-энкодер
        const cfg = {
            codec: 'vp8',
            width: this.width,
            height: this.height,
            bitrate: this.bitrate,      // bps
            framerate: this.fps
        };
        const sup = await VideoEncoder.isConfigSupported(cfg);
        if (!sup.supported) {
            console.warn('VP8 config not supported, trying fallback', sup);
        }

        this.encoder = new VideoEncoder({
            output: (frame, meta) => this._onEncodedFrame(frame, meta),
            error: (e) => console.error('[Cam] encoder error', e)
        });
        this.encoder.configure(cfg);

        this._closing = false;
        this._pumpFrames();

        console.log(`📷 Camera Capturing started`);
    }

    async _stopCapture() {
        this._closing = true;

        try { await this._reader?.cancel(); } catch { }
        this._reader = null;
        this._processor = null;

        if (this.encoder) {
            try { await this.encoder.flush().catch(() => { }); } catch { }
            try { this.encoder.close(); } catch { }
            this.encoder = null;
        }

        if (this._track) {
            try { this._track.stop(); } catch { }
            this._track = null;
        }

        if (this._stream) {
            try { this._stream.getTracks().forEach(t => t.stop()); } catch { }
            this._stream = null;
        }

        drawFrameToCanvas(null, false);

        console.log(`📷 Camera Capturing stopped`);
    }

    async _pumpFrames() {
        while (!this._closing) {
            const r = await this._reader.read();
            if (r.done || !r.value) break;

            /** @type {VideoFrame} */
            const frame = r.value;
            try {
                const isKey = this._wantKeyframe;
                drawFrameToCanvas(frame, true);
                this.encoder.encode(frame, { keyFrame: isKey });
                this._wantKeyframe = false;
            } catch (e) {
                console.warn('[Cam] encode error', e);
            } finally {
                frame.close();
            }
        }
    }

    async _onEncodedFrame(chunk) {
        this._sendChain = this._sendChain.then(async () => {
            const durUs = (typeof chunk.duration === 'bigint')
                ? Number(chunk.duration)
                : (chunk.duration ?? Math.round(1e6 / this.fps));
            const stepTs = Math.max(1, Math.floor(durUs * 90000 / 1e6)) >>> 0;

            const vp8 = new Uint8Array(chunk.byteLength);
            chunk.copyTo(vp8);

            await this.splitter.sendFrame(vp8, { ts: this._ts >>> 0, isKey: (chunk.type === 'key') });

            this._ts = (this._ts + stepTs) >>> 0;
        }).catch(console.error);
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async _wsSend(u8) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(u8);
        }
    }

    _requestKeyframe() {
        this._wantKeyframe = true;
    }
}
