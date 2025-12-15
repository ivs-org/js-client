/**
 * mic_session.js - microphone session
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import {
    importAesGcmKey, buildMediaFrame, makeRtp12, makeIvGcm, gcmEncrypt, concatU8,
    WsBinaryMsgType, MediaType
} from '../../transport/rtp_wsm_utils.js';
import { Storage } from '../../data/storage.js';

export class MicrophoneSession {
    constructor({
        server,             // base wss://...
        token,              // access_token на media-WS
        deviceId,           // из DEVICE_CONNECT (CreatedDevice)
        ssrc,               // author_ssrc
        port,               // dest port
        keyHex,             // 64 hex (32 bytes) AES-256-GCM ключ
        channels = 1,
    }) {
        this.server = server;
        this.token = token;
        this.deviceId = deviceId;
        this.ssrc = (ssrc >>> 0) >>> 0;
        this.mediaPort = port;
        this.keyHex = keyHex.trim();
        this.channels = channels;

        // RTP
        this._seq = 0;
        this._ts = 0;                  // стартуем с 0; шаг 1920 @48k/40ms
        this._pt = 111;                // Opus

        // WS / crypto / encoder
        this.ws = null;
        this.key = null;
        this.encoder = null;

        // Audio
        this.ctx = null;
        this.source = null;
        this._stream = null;
        this.node = null;               // AudioWorkletNode('mic-chunker')

        // WS connection
        this._closing = false;
        this._shouldRun = false;       // хотим ли держать сессию активной
        this._reconning = false;       // сейчас идёт реконнект
        this._wsAttempts = 0;          // счётчик попыток
    }

    async start() {
        if (this._shouldRun) return;
        this._shouldRun = true;

        // Crypto key
        if (this.keyHex !== "") {
            this.key = await importAesGcmKey(this.keyHex);
        }

        // WS media uplink
        await this._connectWS();

        console.log(`🎤 MicrophoneSession started`);
    }

    async stop() {
        this._shouldRun = false;
        await this.stopCapture();   // гасим захват/энкодер
        try { this.ws?.close(); } catch { }
        this.ws = null;
        this._reconning = false;     // обрываем будущие попытки
        this._wsAttempts = 0;
        console.log(`🎤 MicrophoneSession stopped`);
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
                        await this.startCapture();  // запустить микрофон + encoder
                        return resolve();
                    }
                    if (ev.data.includes('ping')) this.ws?.send(JSON.stringify({ ping: {} }));
                }
            };

            this.ws.onerror = (e) => {
                // мгновенно уйдём в onclose — там реконнект
                console.warn('[Mic] ws error', e);
            };

            this.ws.onclose = () => {
                if (!this._shouldRun) return; // нас попросили остановиться
                this._onWsDown();
            };
        });
    }

    _onWsDown() {
        this.stopCapture().catch(() => { });

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
                console.log('[Mic] reconnected');
                return;
            } catch (e) {
                console.warn('[Mic] reconnect failed, retrying...', e);
                // цикл продолжится
            }
        }
    }

    async startCapture() {
        if (this.encoder) return; // уже запущено

        // Audio graph + worklet
        this.ctx = new AudioContext({ sampleRate: 48000 });
        await this.ctx.audioWorklet.addModule('src/media/audio/mic_processor.js');

        const micId = (Storage.getSetting && Storage.getSetting('media.micDeviceId', '')) || '';

        const audio = {
            channelCount: { ideal: this.channels },
            sampleRate: { ideal: 48000 },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            voiceIsolation: true
        };

        if (micId) audio.deviceId = { exact: micId };

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio });
        } catch (e) {
            if (micId) {
                console.warn('🎤 getUserMedia with selected mic failed, fallback to default:', e?.name || e);
                delete audio.deviceId;
                stream = await navigator.mediaDevices.getUserMedia({ audio });
            } else {
                throw e;
            }
        }

        this._stream = stream;

        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings(); // { sampleRate, channelCount, ... }
        const actualSR = settings.sampleRate || 48000;
        const actualCh = settings.channelCount || 1;

        this.source = this.ctx.createMediaStreamSource(stream);
        this.node = new AudioWorkletNode(this.ctx, 'mic-chunker', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            processorOptions: {
                channels: this.channels,
                frameSamples: Math.round(960) // 48 khz @ 20ms, mono
            }
        });
        this.source.connect(this.node);

        // AudioEncoder (Opus)
        this.encoder = new AudioEncoder({
            output: (chunk, meta) => this._onEncoded(chunk, meta),
            error: (e) => console.error('[mic] encoder error', e)
        });
        const encCfg = {
            codec: 'opus',
            numberOfChannels: actualCh,
            sampleRate: actualSR,
            bitrate: 64000,
            bitrateMode: 'variable'
        };
        const { supported } = await AudioEncoder.isConfigSupported(encCfg);
        if (!supported) throw new Error('Opus AudioEncoder not supported');
        this.encoder.configure(encCfg);

        // принимать PCM от ворклета и формировать AudioData
        this.node.port.onmessage = (e) => {
            const { type } = e.data || {};
            if (type !== 'pcm') return;
            const { frames /*int*/, channels /*Array<Float32Array>*/ } = e.data;

            // planar f32: склеиваем канальные плоскости последовательно
            const planeSize = frames * 4;
            const ab = new ArrayBuffer(planeSize * this.channels);
            const view = new DataView(ab);
            let off = 0;
            for (let ch = 0; ch < this.channels; ch++) {
                const f32 = new Float32Array(ab, off, frames);
                f32.set(channels[ch]);
                off += planeSize;
            }

            const audioData = new AudioData({
                format: 'f32',                 // planar f32
                sampleRate: 48000,
                numberOfFrames: frames,
                numberOfChannels: this.channels,
                timestamp: this._ts * 1000,    // мкс не обязателен, но ок
                data: new Uint8Array(ab)
            });

            try {
                this.encoder.encode(audioData);
            } catch (err) {
                console.error('[mic] encode error', err);
            } finally {
                audioData.close();
            }

            // RTP TS шаг под кадр Opus (40мс @48k = 1920)
            this._ts = (this._ts + 1920) >>> 0;
        };

        this._closing = false;
        console.log(`🎤 Microphone Capturing started`);
    }

    async restartCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (this._closing) return;
        await this.stopCapture();
        await this.startCapture();
    }

    async stopCapture() {
        this._closing = true;

        if (this.encoder) {
            try { await this.encoder.flush().catch(() => { }); } catch { }
            try { this.encoder.close(); } catch { }
            this.encoder = null;
        }

        if (this.node) { try { this.node.port.postMessage({ type: 'stop' }); } catch { } }
        try { this.node?.disconnect(); } catch { }
        this.node = null;

        try { this.source?.disconnect(); } catch { }
        this.source = null;

        try { await this.ctx?.close(); } catch { }
        this.ctx = null;

        if (this._stream) {
            try { this._stream.getTracks().forEach(t => t.stop()); } catch { }
        }
        this._stream = null;

        console.log(`🎤 Microphone Capturing stopped`);
    }

    // ---------- encoder output → RTP → AES-GCM → WS ----------
    async _onEncoded(payload/*EncodedAudioChunk*/, meta) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const buf = new ArrayBuffer(payload.byteLength);
        payload.copyTo(new Uint8Array(buf));

        this._seq = (this._seq + 1) & 0xffff;
        const rtp12 = makeRtp12(this._pt, this._seq, this._ts, this.ssrc);
        let wire;

        if (this.key) {
            const iv = makeIvGcm(this.ssrc, this._ts, this._seq);
            
            // opusBytes: Uint8Array из EncodedAudioChunk
            const cipherTag = await gcmEncrypt(this.key, iv, rtp12, buf);

            // RTP(12) + cipher||tag
            wire = concatU8(rtp12, cipherTag);
        }
        else {
            wire = concatU8(rtp12, new Uint8Array(buf));
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const frame = buildMediaFrame(this.ssrc, this.mediaPort, MediaType.RTP, wire);
            this.ws.send(frame);
        }
    }
}
