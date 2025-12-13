/**
 * screen_session.js - Screen sharing session
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { parseMediaFrame, MediaType, importAesGcmKey } from '../../transport/rtp_wsm_utils.js';
import { CanvasRenderer } from './canvas_renderer.js';
import { RTPSplitter } from '../../transport/rtp_splitter.js';

const EVEN = (v) => (typeof v === 'number' ? (v & ~1) : 0);

export class ScreenSession {
    /**
     * Двухфазная модель:
     *   1) startLocalCapture() — getDisplayMedia(), превью, получаем фактическое разрешение.
     *   2) attachRemote(...) — мета от сервера и старт кодирования/отправки.
     */
    constructor({
        fps = 15,
        bitrate = 1_500_000,
        onEnded = null,
    } = {}) {
        this._onEnded = onEnded;

        // remote meta (comes later)
        this.server = null;
        this.token = null;
        this.deviceId = 0;
        this.ssrc = 0;
        this.port = 0;
        this.keyHex = '';

        // WS / crypto / encoder
        this.ws = null;
        this.encoder = null;
        this.aesKey = null;
        this.splitter = null;

        this._sendChain = Promise.resolve();

        // resolved capture format
        this.width = 0;
        this.height = 0;
        this.fps = fps;
        this.bitrate = bitrate;
        this._encWidth = 0;
        this._encHeight = 0;
        this._needCrop = false;

        this._ts = 0;
        this._wantKeyframe = false;

        // media
        this._stream = null;
        this._track = null;
        this._processor = null;
        this._reader = null;

        // state
        this._closing = false;
        this._localRunning = false;
        this._shouldRunRemote = false;
        this._reconning = false;
        this._wsAttempts = 0;
        this._canEncode = false;

        this._previewRenderer = null;
    }

    setPreviewCanvas(canvasEl) {
        if (!this._previewRenderer) {
            this._previewRenderer = new CanvasRenderer(canvasEl, {
                mirrorDefault: true,
                clearColor: '#000',
                autoDpr: true,
                observeResize: true,
            });
        } else {
            this._previewRenderer.setCanvas(canvasEl);
        }
    }

    async startLocalCapture() {
        if (this._localRunning) {
            return this.getCaptureInfo();
        }
        this._localRunning = true;
        this._closing = false;

        // ВАЖНО: должен вызываться из user gesture
        this._stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: this.fps },
            },
            audio: false
        });

        this._track = this._stream.getVideoTracks()[0];
        if (!this._track) {
            await this.stop();
            throw new Error('[Screen] No video track');
        }

        const s = this._track.getSettings?.() ?? {};
        const rawW = s.width || 1280;
        const rawH = s.height || 720;
        if (s.frameRate) this.fps = Math.round(s.frameRate);

        this._encWidth = EVEN(rawW) || rawW;
        this._encHeight = EVEN(rawH) || rawH;
        this._needCrop = (this._encWidth !== rawW) || (this._encHeight !== rawH);

        // Для протокола/рендера нужно сообщать то, что реально будем кодировать.
        this.width = this._encWidth;
        this.height = this._encHeight;

        this._track.onended = () => {
            try { this._onEnded && this._onEnded(); } catch { }
            this.stop().catch(() => { });
        };

        this._processor = new MediaStreamTrackProcessor({ track: this._track });
        this._reader = this._processor.readable.getReader();

        this._pumpFrames();

        console.log(`🖥️ Screen local capture started: ${this.width}x${this.height}@${this.fps}`);
        return this.getCaptureInfo();
    }

    getCaptureInfo() {
        return {
            width: this.width,
            height: this.height,
            fps: this.fps,
        };
    }

    async attachRemote({ server, token, deviceId, ssrc, port, keyHex }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.port = port;
        this.keyHex = (keyHex || '').trim();

        this._shouldRunRemote = true;

        if (!this._localRunning) {
            console.warn('[Screen] attachRemote called before local capture; ignoring');
            return;
        }

        if (!this.aesKey && this.keyHex) {
            this.aesKey = await importAesGcmKey(this.keyHex);
        }

        if (!this.splitter) {
            this.splitter = new RTPSplitter({
                ssrc: this.ssrc,
                port: this.port,
                aesKey: this.aesKey,
                sendFn: (u8) => this._wsSend(u8)
            });
        }

        if (!this.encoder) {
            const cfg = {
                codec: 'vp8',
                width: this._encWidth || this.width,
                height: this._encHeight || this.height,
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
        }

        await this._connectWS();
    }

    async stop() {
        this._shouldRunRemote = false;
        this._canEncode = false;

        // stop remote
        try { this.ws?.close(); } catch { }
        this.ws = null;
        this._reconning = false;
        this._wsAttempts = 0;

        // stop encoder/splitter
        if (this.encoder) {
            try { await this.encoder.flush().catch(() => { }); } catch { }
            try { this.encoder.close(); } catch { }
            this.encoder = null;
        }
        this.splitter = null;

        // stop local
        await this._stopLocalCapture();

        console.log('🖥️ ScreenSession stopped');
    }

    async _stopLocalCapture() {
        this._closing = true;
        this._localRunning = false;

        try { await this._reader?.cancel(); } catch { }
        this._reader = null;
        this._processor = null;

        if (this._track) {
            try { this._track.stop(); } catch { }
            this._track = null;
        }

        if (this._stream) {
            try { this._stream.getTracks().forEach(t => t.stop()); } catch { }
            this._stream = null;
        }
    }

    async _connectWS() {
        if (!this.server || !this.token) {
            throw new Error('[Screen] server/token not set');
        }

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
                    let msg; try { msg = JSON.parse(ev.data); } catch { }

                    if (msg?.connect_response) {
                        this._canEncode = true;
                        this._wantKeyframe = true;
                        return resolve();
                    }

                    if (ev.data.includes('ping')) {
                        this.ws?.send(JSON.stringify({ ping: {} }));
                    }
                    return;
                }

                const frm = parseMediaFrame(ev.data);
                if (!frm || frm.mediaType === MediaType.RTCP) {
                    this._wantKeyframe = true;
                }
            };

            this.ws.onerror = (e) => {
                console.warn('[Screen] ws error', e);
            };

            this.ws.onclose = () => {
                this._canEncode = false;
                if (!this._shouldRunRemote) return;
                this._onWsDown();
            };
        });
    }

    _onWsDown() {
        if (this._reconning) return;
        this._reconning = true;
        this._reconnectLoop();
    }

    async _reconnectLoop() {
        while (this._shouldRunRemote && this._reconning) {
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

    async _pumpFrames() {
        while (!this._closing) {
            const r = await this._reader.read();
            if (r.done || !r.value) break;

            /** @type {VideoFrame} */
            const frame = r.value;
            let encFrame = null;

            try {
                const bitmap = await createImageBitmap(frame);
                try {
                    this._previewRenderer.drawBitmapContain(bitmap);
                } finally {
                    bitmap.close?.();
                }

                if (this._canEncode && this.encoder) {
                    const isKey = this._wantKeyframe;
                    if (this._needCrop) {
                        encFrame = new VideoFrame(frame, {
                            visibleRect: {
                                x: 0,
                                y: 0,
                                width: this._encWidth,
                                height: this._encHeight
                            }
                        });
                        this.encoder.encode(encFrame, { keyFrame: isKey });
                    } else {
                        this.encoder.encode(frame, { keyFrame: isKey });
                    }
                    this._wantKeyframe = false;
                }
            } catch (e) {
                console.warn('[Screen] pump/encode error', e);
            } finally {
                try { encFrame?.close(); } catch { }
                frame.close();
            }
        }
    }

    async _onEncodedFrame(chunk) {
        if (!this._canEncode || !this.splitter) return;

        this._sendChain = this._sendChain.then(async () => {
            if (!this._canEncode || !this.splitter) return;

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
}
