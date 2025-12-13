/**
 * screen_session.js - Screen sharing session
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

function drawFrameToCanvas(frame, canvasId = 'demoPreview') {
    const preview = document.getElementById(canvasId);
    if (!preview) return;

    const ctx = preview.getContext('2d');
    if (!ctx) {
        console.error('[Screen] Failed to get 2d context');
        return;
    }

    const width = preview.width;
    const height = preview.height;

    if (frame) {
        // Для демонстрации экрана — БЕЗ зеркалирования
        ctx.save();
        ctx.drawImage(frame, 0, 0, width, height);
        ctx.restore();
    } else {
        ctx.clearRect(0, 0, width, height);
    }
}

export class ScreenSession {
    /**
     * @param {{
     *   server: string,      // wss://... для media-WS
     *   token: string,       // access_token
     *   deviceId: number,    // CreatedDevice
     *   ssrc: number,        // author_ssrc
     *   port: number,        // dest port
     *   keyHex: string,      // AES-256-GCM key hex (64)
     *   width: number,
     *   height: number,
     *   fps?: number,
     *   bitrate?: number,
     *   previewCanvasId?: string
     * }} params
     */
    constructor({
        server,
        token,
        deviceId,
        ssrc,
        port,
        keyHex,
        width,
        height,
        fps = 15,
        bitrate = 1_500_000,
        previewCanvasId = 'demoPreview',
    }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.port = port;
        this.keyHex = (keyHex || '').trim();

        // WS / crypto / encoder
        this.ws = null;
        this.encoder = null;
        this.aesKey = null;
        this.splitter = null;

        this._sendChain = Promise.resolve();

        this.width = width;
        this.height = height;
        this.fps = fps;
        this.bitrate = bitrate;
        this._ts = 0;
        this._wantKeyframe = false;

        // media
        this._stream = null;
        this._track = null;
        this._processor = null;
        this._reader = null;

        // WS connection
        this._closing = false;
        this._shouldRun = false;
        this._reconning = false;
        this._wsAttempts = 0;

        this._previewCanvasId = previewCanvasId;
    }

    async start() {
        if (this._shouldRun) return;
        this._shouldRun = true;

        if (!this.aesKey && this.keyHex) {
            this.aesKey = await importAesGcmKey(this.keyHex);
        }

        await this._connectWS();

        console.log(
            `🖥️ ScreenSession started: ${this.width}x${this.height}@${this.fps}, br=${this.bitrate}`
        );
    }

    async stop() {
        this._shouldRun = false;
        await this._stopCapture();
        try { this.ws?.close(); } catch { }
        this.ws = null;
        this._reconning = false;
        this._wsAttempts = 0;
        console.log('🖥️ ScreenSession stopped');
    }

    async _connectWS() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.server);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.ws.send(JSON.stringify({
                    connect_request: { channel_type: 1 /* wsm */, access_token: this.token }
                }));
            };

            this.ws.onmessage = async (ev) => {
                if (typeof ev.data === 'string') {
                    let msg;
                    try { msg = JSON.parse(ev.data); } catch { }

                    if (msg?.connect_response) {
                        try {
                            await this._startCapture();
                            return resolve();
                        } catch (e) {
                            console.error('[Screen] startCapture failed', e);
                            return reject(e);
                        }
                    }

                    if (ev.data.includes('ping')) {
                        this.ws?.send(JSON.stringify({ ping: {} }));
                    }
                    return;
                }

                const frm = parseMediaFrame(ev.data);
                if (!frm || frm.mediaType === MediaType.RTCP) {
                    this._wantKeyframe = true;
                    console.log('[Screen] RTCP force key frame');
                }
            };

            this.ws.onerror = (e) => {
                console.warn('[Screen] ws error', e);
                // уйдём в onclose → реконнект
            };

            this.ws.onclose = () => {
                if (!this._shouldRun) return;
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
            const delayMs = Math.min(10_000, 500 * Math.pow(2, this._wsAttempts));
            if (this._wsAttempts > 0) {
                await new Promise(r => setTimeout(r, delayMs));
            }
            this._wsAttempts++;

            try {
                await this._connectWS();
                this._reconning = false;
                console.log('[Screen] reconnected');
                return;
            } catch (e) {
                console.warn('[Screen] reconnect failed, retrying...', e);
            }
        }
    }

    async _startCapture() {
        if (this.encoder) return;

        // ВАЖНО: getDisplayMedia даёт пользователю стандартный UI выбора экрана/окна/вкладки
        try {
            this._stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: this.width },
                    height: { ideal: this.height },
                    frameRate: { ideal: this.fps },
                    // displaySurface / logicalSurface браузеры обычно сами решают
                },
                audio: false // системный/таба аудио можно прикрутить позже, сейчас микрофон живёт отдельно
            });
        } catch (e) {
            console.error('[Screen] getDisplayMedia failed', e);
            // если юзер нажал "Отмена" — просто выходим
            throw e;
        }

        this._track = this._stream.getVideoTracks()[0];
        if (!this._track) {
            throw new Error('[Screen] No video track');
        }

        // Если юзер нажал "остановить демонстрацию" в системном UI
        this._track.onended = () => {
            console.log('[Screen] track ended by user');
            this.stop().catch(() => { });
        };

        this._processor = new MediaStreamTrackProcessor({ track: this._track });
        this._reader = this._processor.readable.getReader();

        this.splitter = new RTPSplitter({
            ssrc: this.ssrc,
            port: this.port,
            aesKey: this.aesKey,
            sendFn: (u8) => this._wsSend(u8)
        });

        const cfg = {
            codec: 'vp8',
            width: this.width,
            height: this.height,
            bitrate: this.bitrate,
            framerate: this.fps
        };

        const sup = await VideoEncoder.isConfigSupported(cfg);
        if (!sup.supported) {
            console.warn('[Screen] VP8 config not fully supported', sup);
        }

        this.encoder = new VideoEncoder({
            output: (chunk, meta) => this._onEncodedFrame(chunk, meta),
            error: (e) => console.error('[Screen] encoder error', e)
        });
        this.encoder.configure(cfg);

        this._closing = false;
        this._pumpFrames();

        console.log('[Screen] Capturing started');
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

        drawFrameToCanvas(null, this._previewCanvasId);

        console.log('[Screen] Capturing stopped');
    }

    async _pumpFrames() {
        while (!this._closing) {
            const r = await this._reader.read();
            if (r.done || !r.value) break;

            /** @type {VideoFrame} */
            const frame = r.value;
            try {
                const isKey = this._wantKeyframe;
                drawFrameToCanvas(frame, this._previewCanvasId);
                this.encoder.encode(frame, { keyFrame: isKey });
                this._wantKeyframe = false;
            } catch (e) {
                console.warn('[Screen] encode error', e);
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

            await this.splitter.sendFrame(vp8, {
                ts: this._ts >>> 0,
                isKey: (chunk.type === 'key')
            });

            this._ts = (this._ts + stepTs) >>> 0;
        }).catch(console.error);
    }

    async _wsSend(u8) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(u8);
        }
    }

    _requestKeyframe() {
        this._wantKeyframe = true;
    }
}
