/**
 * cam_session.js - Camera session
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { parseMediaFrame, MediaType, importAesGcmKey } from '../../transport/rtp_wsm_utils.js';
import { CanvasRenderer } from './canvas_renderer.js';
import { RTPSplitter } from '../../transport/rtp_splitter.js';
import { Storage } from '../../data/storage.js';

const EVEN = (v) => (typeof v === 'number' ? (v & ~1) : 0);
export class CameraSession {
    /**
     * Двухфазная модель:
     *   1) startLocalCapture() — поднимаем камеру, получаем ФАКТИЧЕСКОЕ разрешение, показываем превью.
     *   2) attachRemote(...) — получаем мету от сервера (ssrc/port/key/token) и начинаем стримить.
     */
    constructor({
        mirrorPreview = true,
        fps = 25,
        bitrate = 1_200_000,
        facingMode = undefined, // Firefox ESR: не указываем по умолчанию, чтобы не конфликтовать с обычными камерами
    } = {}) {
        // local prefs
        this._mirrorPreview = mirrorPreview;
        this._facingMode = facingMode;

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

        // Firefox ESR: canvas-based захват
        this._captureCanvas = null;
        this._captureCtx = null;
        this._videoEl = null;
        this._frameRequest = null;

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
                clearColor: '#000',
                autoDpr: true,
                observeResize: true
            });
        } else {
            this._previewRenderer.setCanvas(canvasEl);
        }
    }

    /**
     * Поднять камеру (без общения с сервером).
     * Возвращает фактические параметры трека.
     */
    async startLocalCapture() {
        if (this._localRunning) {
            return this.getCaptureInfo();
        }

        this._localRunning = true;
        this._closing = false;

        const camId = (Storage.getSetting && Storage.getSetting('media.cameraDeviceId', '')) || '';

        // Firefox ESR: более мягкий запрос без resizeMode и с минимальными ограничениями
        const video = {
            width: { ideal: this.width || 640 },
            height: { ideal: this.height || 480 },
            frameRate: { ideal: this.fps || 25 },
        };

        // facingMode только если явно указан (для фронтальных камер мобильных устройств)
        if (this._facingMode) {
            video.facingMode = this._facingMode;
        }

        if (camId) {
            video.deviceId = { exact: camId };
        }

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (e) {
            // если exact deviceId умер — fallback на default
            if (camId) {
                console.warn('📷 [Cam] selected camera failed, fallback to default:', e?.name || e);
                delete video.deviceId;
                this._stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
            } else {
                throw e;
            }
        }

        this._track = this._stream.getVideoTracks()[0];
        if (!this._track) {
            await this.stop();
            throw new Error('📷 [Cam] No video track');
        }

        const s = this._track.getSettings?.() ?? {};
        if (s.frameRate) this.fps = Math.round(s.frameRate);

        // Firefox ESR: MediaStreamTrackProcessor недоступен, используем canvas-based подход
        if ('MediaStreamTrackProcessor' in window) {
            // Современный подход с WebCodecs
            this._processor = new MediaStreamTrackProcessor({ track: this._track });
            this._reader = this._processor.readable.getReader();

            // берём ПЕРВЫЙ кадр и считаем размеры по нему (это и есть фактический размер потока)
            const first = await this._reader.read();
            if (first.done || !first.value) {
                await this.stop();
                throw new Error('📷 [Cam] No video frames');
            }

            const firstFrame = first.value;
            try {
                const fw = (firstFrame.displayWidth || firstFrame.codedWidth || s.width || 640) | 0;
                const fh = (firstFrame.displayHeight || firstFrame.codedHeight || s.height || 360) | 0;

                this._encWidth = EVEN(fw) || fw;
                this._encHeight = EVEN(fh) || fh;
                this._needCrop = (this._encWidth !== fw) || (this._encHeight !== fh);

                this.width = this._encWidth;
                this.height = this._encHeight;
            } finally {
                firstFrame.close();
            }

            this._pumpFrames();
        } else {
            // Firefox ESR: canvas-based захват
            const fw = (s.width || 640) | 0;
            const fh = (s.height || 480) | 0;

            this._encWidth = EVEN(fw) || fw;
            this._encHeight = EVEN(fh) || fh;
            this._needCrop = false;

            this.width = this._encWidth;
            this.height = this._encHeight;

            this._setupCanvasCapture();
        }

        // если пользователь/ОС выключили камеру
        this._track.onended = () => {
            this.stop().catch(() => { });
        };

        console.log(`📷 Camera local capture started: ${this.width}x${this.height}@${this.fps}`);
        return this.getCaptureInfo();
    }

    /**
     * Firefox ESR: canvas-based захват кадров вместо MediaStreamTrackProcessor
     */
    _setupCanvasCapture() {
        // Создаём canvas для захвата кадров
        this._captureCanvas = document.createElement('canvas');
        this._captureCanvas.width = this._encWidth;
        this._captureCanvas.height = this._encHeight;
        this._captureCtx = this._captureCanvas.getContext('2d', { willReadFrequently: true });

        // Создаём video элемент для потока
        this._videoEl = document.createElement('video');
        this._videoEl.srcObject = this._stream;
        this._videoEl.muted = true;
        this._videoEl.playsInline = true;

        const startCapture = () => {
            this._videoEl.play().catch(e => console.warn('📷 [Cam] video play error:', e));

            const captureFrame = () => {
                if (this._closing || !this._captureCtx || !this._videoEl) return;

                try {
                    // Рисуем кадр из video на canvas
                    this._captureCtx.drawImage(this._videoEl, 0, 0, this._encWidth, this._encHeight);

                    // Создаём VideoFrame из canvas
                    if (this._canEncode && this.encoder) {
                        const frame = new VideoFrame(this._captureCanvas, {
                            timestamp: performance.now() * 1000 // в микросекундах
                        });

                        const isKey = this._wantKeyframe;
                        this.encoder.encode(frame, { keyFrame: isKey });
                        this._wantKeyframe = false;

                        frame.close();
                    }

                    // Показываем превью
                    if (this._previewRenderer) {
                        const bitmap = this._captureCanvas;
                        this._previewRenderer.drawBitmapContain(bitmap);
                    }
                } catch (e) {
                    console.warn('📷 [Cam] captureFrame error:', e);
                }

                // Следующий кадр
                const frameInterval = 1000 / this.fps;
                this._frameRequest = setTimeout(() => {
                    if (!this._closing) {
                        requestAnimationFrame(captureFrame);
                    }
                }, frameInterval);
            };

            // Запускаем захват после загрузки первого кадра
            this._videoEl.onloadeddata = () => {
                requestAnimationFrame(captureFrame);
            };
        };

        // Ждём загрузки потока
        if (this._videoEl.readyState >= 2) {
            startCapture();
        } else {
            this._videoEl.onloadedmetadata = startCapture;
        }
    }

    async _stopCanvasCapture() {
        if (this._frameRequest) {
            clearTimeout(this._frameRequest);
            this._frameRequest = null;
        }

        if (this._videoEl) {
            try { this._videoEl.pause(); } catch { }
            this._videoEl.srcObject = null;
            this._videoEl = null;
        }

        if (this._captureCanvas) {
            this._captureCanvas = null;
            this._captureCtx = null;
        }
    }

    async restartCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this._closing) return;
        await this._stopLocalCapture();
        await this.startLocalCapture();
    }

    getCaptureInfo() {
        return {
            width: this.width,
            height: this.height,
            fps: this.fps,
        };
    }

    /**
     * Прикрепить серверную мету и начать remote-стрим.
     */
    async attachRemote({ server, token, deviceId, ssrc, port, keyHex }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.port = port;
        this.keyHex = (keyHex || '').trim();

        this._shouldRunRemote = true;

        if (!this._localRunning) {
            // критично: без локального трека нам нечего отправлять
            console.warn('📷 [Cam] attachRemote called before local capture; ignoring');
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
                console.warn('📷 [Cam] VP8 config not supported, trying anyway', sup);
            }

            this.encoder = new VideoEncoder({
                output: (chunk, meta) => this._onEncodedFrame(chunk, meta),
                error: (e) => console.error('📷 [Cam] encoder error', e)
            });
            this.encoder.configure(cfg);
        }

        // connect WS (or reconnect)
        await this._connectWS();
    }

    async stop() {
        this._shouldRunRemote = false;
        this._canEncode = false;

        // stop remote
        try {
            this.ws?.send(JSON.stringify({ disconnect: {} }));
            this.ws?.close();
        } catch { }
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

        console.log('📷 [Cam] CameraSession stopped');
    }

    async _stopLocalCapture() {
        this._closing = true;
        this._localRunning = false;

        // Останавливаем canvas-based захват (Firefox ESR)
        await this._stopCanvasCapture();

        // Останавливаем MediaStreamTrackProcessor (современный подход)
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
            throw new Error('📷 [Cam] server/token not set');
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
                    if (ev.data.includes('ping')) this.ws?.send(JSON.stringify({ ping: {} }));
                    return;
                }

                const frm = parseMediaFrame(ev.data);
                if (!frm || frm.mediaType === MediaType.RTCP) {
                    this._wantKeyframe = true;
                    // console.log('[Cam] RTCP force keyframe');
                }
            };

            this.ws.onerror = (e) => {
                console.warn('📷 [Cam] ws error', e);
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
                console.log('📷 [Cam] reconnected');
                return;
            } catch (e) {
                console.warn('📷 [Cam] reconnect failed, retrying...', e);
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
                console.warn('📷 [Cam] pump/encode error', e);
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
