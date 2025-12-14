/**
 * media_channel.js - Audio / Video Renderer
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { AudioShared } from './audio/audio_shared.js';
import { RTPCollector } from '../transport/rtp_collector.js';
import { VP8Decoder } from '../codecs/vp8_decoder.js';
import { OpusDecoder } from '../codecs/opus_decoder.js';
import { CanvasRenderer } from './video/canvas_renderer.js';
import {
    importAesGcmKey, buildMediaFrame, parseMediaFrame, rtpHeaderLen, serializeRTCP_APP, gcmDecrypt, makeIvGcm,
    WsBinaryMsgType
} from '../transport/rtp_wsm_utils.js';

export class MediaChannel {
    constructor({ url, port, token, channelType, deviceId, clientId, label, receiver_ssrc, author_ssrc, cryptoKey }) {
        this.url = url; // base ws URL (ws://host:port)
        this.port = port; // media port from device_connected
        this.token = token;

        this.channelType = channelType; // 'video'|'audio'
        this.deviceId = deviceId;
        this.clientId = clientId;
        this.label = label;

        this.receiver_ssrc = receiver_ssrc;
        this.author_ssrc = author_ssrc;

        this.ring = null;
        this.workletNode = null;
        this.reconnectTimer = null;

        this.closing = false;
        this.ws = null;
        this._bgPaused = false;
        this._hasCrypto = cryptoKey !== "";
        if (this._hasCrypto) this._cryptoKeyPromise = importAesGcmKey(cryptoKey);

        if (channelType === 'audio') {
            this.decoder = new OpusDecoder((frame) => this._onAudioFrame(frame));
            this.audioCtx = AudioShared.ensureContext();
            console.log(`✓ [MediaChannel] Audio channel constructed: ${label}`);
        }
        else {
            this.collector = new RTPCollector((frame) => this._onVideoFrame(frame));
            this.decoder = new VP8Decoder(() => {
                console.warn('⚠️ Requesting Force Key Frame due to decoder errors');
                this._sendForceKeyFrame();
            });
            this.containerEl = null;
            this._previewRenderer = null;
            console.log(`✓ [MediaChannel] Video channel constructed: ${label}`);
        }

        this.worked = true;
    }

    pauseForBackground() {
        if (this.channelType !== 'video' || this._bgPaused) return;
        this._bgPaused = true;

        // Закрыть media WS, остановить декодер и коллектор, но DOM оставить
        _closeWebSocket();

        if (this.vp8Decoder && this.vp8Decoder.decoder) {
            try { this.vp8Decoder.decoder.close(); } catch { }
        }

        // сбросить внутренние состояния
        if (this.collector && typeof this.collector.reset === 'function') {
            this.collector.reset();
        }
    }

    async resumeFromForeground() {
        if (this.channelType !== 'video' || !this._bgPaused) return;
        this._bgPaused = false;

        // пересоздать декодер
        this.vp8Decoder = new VP8Decoder(() => {
            console.warn('⚠️ Requesting Force Key Frame due to decoder errors (resume)');
        });

        // Реинициализировать WS
        this._connectWS();
    }

    _initAudio() {
        const channels = 2;
        const capacity = 48000; // 1 сек/канал

        // индексы (общие для всех каналов)
        const idxSAB = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
        const idx = new Int32Array(idxSAB);
        idx[0] = 0; // write
        idx[1] = 0; // read

        // по SAB на канал
        const dataSABs = Array.from({ length: channels }, () =>
            new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * capacity)
        );
        const dataViews = dataSABs.map(sab => new Float32Array(sab));

        // создать ворклет-ноду
        this.audioCtx.audioWorklet.addModule('./src/media/audio/audio_processor.js');
        this.workletNode = new AudioWorkletNode(this.audioCtx, 'audio-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],              // <— стерео на выходе ворклета
            channelCount: 2,                      // <— сам узел «знает», что он стерео
            channelCountMode: 'explicit',         // <— запретить авто-микш
            channelInterpretation: 'speakers',    // <— колонки, не «discrete»
            processorOptions: {
                idxSAB,
                dataSABs,
                capacity,
                channels
            }
        });

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 1.0;
        this.workletNode.connect(this.gainNode).connect(this.audioCtx.destination);

        this.ring = { idx, dataViews, capacity, channels };

        console.log(`🎧 Audio channel initialized`);
    }

    start(onAttached) {
        if (this.channelType === 'audio') {
            this._connectWS();
            console.log(`🎧 Audio channel started: ${this.label}`);

            return;
        }

        // create UI element and notify caller
        const wrapper = document.createElement('div');
        wrapper.className = 'stream';
        const title = document.createElement('div');
        title.className = 'mini';
        title.textContent = `${this.label} (${this.channelType})`;
        let canvas = document.createElement('canvas');
        canvas.width = 864; canvas.height = 480;
        wrapper.appendChild(title);
        wrapper.appendChild(canvas);
        this.containerEl = wrapper;

        if (!this._previewRenderer) {
            this._previewRenderer = new CanvasRenderer(canvas, {
                clearColor: '#000',
                autoDpr: true,
                observeResize: true,
            });
        } else {
            this._previewRenderer.setCanvas(canvas);
        }
        
        if (onAttached) onAttached(wrapper);

        this._connectWS();
        console.log(`🎬 Video channel started: ${this.label}`);
    }

    /**
    * Закрыть WebSocket корректно и гарантированно.
    * @param {number} code - код закрытия (например, 1000)
    * @param {string} reason - причина
    * @param {number} timeoutMs - сколько ждать onclose прежде чем сдаться
    */
    _closeWebSocket(code = 1000, reason = 'client stop', timeoutMs = 500) {
        const ws = this.ws;
        if (!ws) return;

        this._closing = true;      // сигнал остальным хэндлерам «ничего не делать»
        this.worked = false;       // чтобы onclose не переподнял

        // убираем автопереподключение
        if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }

        // отписываем обработчики (чтобы ничего не пересоздали)
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;

        try {
            // ws.send(JSON.stringify({ disconnect_request: {} }));
        } catch { }

        // если соединение ещё не OPEN — дождёмся onopen и сразу закроем
        if (ws.readyState === WebSocket.CONNECTING) {
            // навешиваем разовый onopen, чтобы закрыть корректно
            ws.addEventListener('open', () => {
                try { ws.close(code, reason); } catch { }
            }, { once: true });
        } else {
            try { ws.close(code, reason); } catch { }
        }

        // «жёсткая» сдача: если onclose не прилетел за timeout — просто забываем ссылку
        setTimeout(() => {
            if (this.ws === ws) {
                console.warn('media ws close timeout — forcing detach');
                this.ws = null;
                this._closing = false;
            }
        }, timeoutMs);
    }

    stop() {
        this.worked = false;
        console.log(`🎬 Media channel stopped: ${this.label}`);

        this._closeWebSocket(1000, 'client stop', 800);

        if (this.workletNode) this.workletNode.disconnect();
        if (this.gainNode) this.gainNode.disconnect();
        if (this.decoder) {
            try { this.decoder.close(); } catch { }
            this.decoder = null;
        }

        if (this.collector && typeof this.collector.reset === "function") {
            this.collector.reset();
        }
        this.collector = null;

        if (this.containerEl && this.containerEl.parentNode) {
            console.log("Removing media container element.");
            this.containerEl.parentNode.removeChild(this.containerEl);
        }
        this.containerEl = null;

        console.log("✓ Media channel fully stopped and cleaned up.");
    }

    _sendRTPInit() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send RTP init.");
            return;
        }

        const headerSSRC = this.receiver_ssrc || 0;      // значение для первых 4 байт
        const headerPort = this.port || 0;               // следующие 2 байта
        const headerType = this.headerType || 2;         // следующие 2 байта (1 = rtcp/force-keyframe; 2 = RTP по договорённости)

        // RTP header — 12 bytes
        const rtpBuf = new ArrayBuffer(12);
        const rtpView = new DataView(rtpBuf);
        rtpView.setUint8(0, 0x80);                            // V=2, P=0, X=0, CC=0
        rtpView.setUint8(1, 96);                              // PT (dynamic)
        rtpView.setUint16(2, Math.floor(Math.random() * 65536), false); // seq (network order) — RTP normally big-endian
        rtpView.setUint32(4, 0, false);                       // timestamp (network order)
        rtpView.setUint32(8, headerSSRC, false);              // ssrc in RTP header (network order)

        // send
        try {
            this.ws.send(buildMediaFrame(headerSSRC, headerPort, headerType, rtpBuf));
            console.log(`Sent RTP init: headerSSRC=${headerSSRC} port=${headerPort} type=${headerType}`);
        } catch (e) {
            console.warn('Failed to send RTP init:', e);
        }
    }

    _sendForceKeyFrame() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send RTCP force keyframe.");
            return;
        }

        const headerSSRC = this.receiver_ssrc || 0;  // первые 4 байта
        const headerPort = this.port || 0;           // следующие 2 байта
        const headerType = 1;                        // 1 = RTCP / force keyframe

        // === Формируем RTCP APP пакет ===
        const ssrc = headerSSRC;
        const appName = 1;// 0x464B4652; // 'FKFR' = Force Key FRame (в hex)
        const payload = new Uint8Array(0); // пустой payload

        const rtcpBuf = serializeRTCP_APP(ssrc, appName, payload);

        // === Отправляем ===
        try {
            this.ws.send(buildMediaFrame(headerSSRC, headerPort, headerType, rtcpBuf));
            console.log(`Sent ForceKeyFrame RTCP: ssrc=${headerSSRC}, port=${headerPort}, type=${headerType}`);
        } catch (e) {
            console.warn("Failed to send RTCP force keyframe:", e);
        }
    }

    sendPong() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try { this.ws.send(JSON.stringify({ ping: {} })); } catch { }
        }
    }

    _connectWS() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.warn('media ws already active, skip connect');
            return;
        }

        // убираем прежний таймер
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

        const wsUrl = this.url;
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';
        this._gcmProbeDone = false;

        this.ws.onopen = () => {
            if (this.closing) return; // если уже закрываем — не логинимся
            console.log('media ws open, send connect_request with channel_type and token');
            this.ws.send(JSON.stringify({ connect_request: { channel_type: 1 /* wsm */, access_token: this.token } }));
        };

        this.ws.onmessage = async (ev) => {
            if (this.closing) return;
            if (!(ev.data instanceof ArrayBuffer)) {
                // текстовые
                const txt = typeof ev.data === 'string' ? ev.data : await ev.data.text();
                let msg; try { msg = JSON.parse(txt); } catch { }
                if (msg.connect_response) {
                    console.log('ws media logon');
                    this._sendRTPInit();
                    if (this.channelType !== 'audio') {
                        this._sendForceKeyFrame();
                    } else {
                        this.ws.send(JSON.stringify({ ping: {} }));
                    }
                }
                if (txt.includes('ping')) this.ws.send(JSON.stringify({ ping: {} }));
                return;
            }

            const frm = parseMediaFrame(ev.data);
            if (!frm || frm.msgType !== WsBinaryMsgType.Media) return;

            const rtp = new Uint8Array(frm.payload);           // весь RTP (12+ext + payload|tag)
            const hlen = rtpHeaderLen(rtp);
            if (hlen < 12 || hlen > rtp.length) return;

            if (!this._hasCrypto) {
                if (this.channelType === 'video') {
                    if (this._bgPaused) return;

                    const hdr = rtp.subarray(0, hlen);
                    const plain = rtp.subarray(hlen);

                    const rtpPlain = new Uint8Array(hlen + plain.length);
                    rtpPlain.set(hdr, 0);
                    rtpPlain.set(plain, hlen);

                    this.collector.process(rtpPlain.buffer);
                } else {
                    if (this.decoder && this.workletNode) {
                        const plain = rtp.subarray(hlen);
                        this.decoder.decode(plain);
                    }
                }
                return;
            }

            const rtpHdr = rtp.subarray(0, 12);      // AAD
            const cipherTag = rtp.subarray(hlen);

            const dv = new DataView(rtpHdr.buffer, rtpHdr.byteOffset, 12);
            const seq = dv.getUint16(2, false);
            const ts = dv.getUint32(4, false);
            const ssrc = dv.getUint32(8, false);

            const key = await this._cryptoKeyPromise;

            let plainBuf;
            try {
                const iv = makeIvGcm(ssrc >>> 0, ts >>> 0, seq >>> 0);
                plainBuf = await gcmDecrypt(key, iv, rtpHdr, cipherTag);
            } catch (e) {
                console.warn('GCM decrypt failed', { e, ch: this.channelType, seq, ts, ssrc, len: cipherTag.length });
                return;
            }
            if (this.channelType === 'video') {
                if (this._bgPaused) return;

                const hdr = rtp.subarray(0, hlen);
                const plain = new Uint8Array(plainBuf);  // результат AES-GCM (VP8 payload)

                const rtpPlain = new Uint8Array(hlen + plain.length);
                rtpPlain.set(hdr, 0);
                rtpPlain.set(plain, hlen);

                this.collector.process(rtpPlain.buffer);
            } else {
                if (this.decoder && this.workletNode) {
                    this.decoder.decode(plainBuf);
                }
            }
        };

        this.ws.onclose = (ev) => {
            console.log('media ws closed', ev.code, ev.reason);
            // если нас закрыли намеренно — НЕ переподключаемся
            if (!this.closing && this.worked) {
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this._connectWS();
                }, 2000);
            }
        };

        this.ws.onerror = (e) => {
            console.error('media ws err', e);
            try { this.ws && this.ws.close(); } catch { }
        };
    }

    async _onVideoFrame(encodedFrame) {
        try {
            const frame = await this.decoder.decode(encodedFrame);
            if (!frame || !this._previewRenderer) return;

            const bitmap = await createImageBitmap(frame);
            try {
                this._previewRenderer.drawBitmapContain(bitmap);
            } finally {
                bitmap.close?.();
                frame.close();
            }
        } catch (e) {
            console.error('decode/render err', e);
        }
    }

    _pushToRing(channelsPCM /* Array<Float32Array> */) {
        if (!this.ring) return; // защита

        const { idx, dataViews, capacity, channels } = this.ring;
        const write = Atomics.load(idx, 0);
        const read = Atomics.load(idx, 1);
        const used = (write - read + capacity) % capacity;
        const free = capacity - used - 1;

        const len = channelsPCM[0].length;
        if (len > free) {
            // не растим задержку: подвинем read на «лишнее»
            const need = len - free;
            Atomics.store(idx, 1, (read + need) % capacity);
        }

        const w0 = Atomics.load(idx, 0);
        const end = w0 + len;

        for (let ch = 0; ch < channels; ch++) {
            const dst = dataViews[ch];
            const src = channelsPCM[ch] || channelsPCM[0];

            if (end <= capacity) {
                dst.set(src, w0);
            } else {
                const first = capacity - w0;
                dst.set(src.subarray(0, first), w0);
                dst.set(src.subarray(first), 0);
            }
        }
        Atomics.store(idx, 0, end % capacity);

        // периодический лог уровня буфера (раз в ~100 блоков)
        /*this._dbg = (this._dbg || 0) + 1;
        if (this._dbg % 100 === 0) {
            const w = Atomics.load(idx, 0), r = Atomics.load(idx, 1);
            const avail = (w - r + capacity) % capacity;
            console.debug('[AUDIO] ring avail:', avail);
        }*/
    }

    _onAudioFrame(audioData) {
        const numChannels = audioData.numberOfChannels;
        const numFrames = audioData.numberOfFrames;

        // выделяем буфер на все каналы одновременно
        const interleaved = new Float32Array(audioData.allocationSize({ planeIndex: 0 }));
        const planeIndex = 0; // аудио всегда один
        audioData.copyTo(interleaved, { planeIndex });
        audioData.close();

        // deinterleave
        const channelsPCM = new Array(numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
            const buf = new Float32Array(numFrames);
            for (let i = 0; i < numFrames; i++) buf[i] = interleaved[i * numChannels + ch];
            channelsPCM[ch] = buf;
        }

        if (this.ring) {
            this._pushToRing(channelsPCM);
        }
    }

    close() {
        try { this.ws && this.ws.close(); } catch { }
    }
}
