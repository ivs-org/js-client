/**
 * rtp_splitter.js - rtp splitter, один входной VP8-фрейм -> чанки по SPLITTED_PACKET_SIZE
 * AAD (если шифруем) — первые 12 байт RTP. Plaintext — RTP extension + VP8 payload.
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import {
    buildMediaFrame,
    MediaType,
    makeRtp12,
    makeIvGcm,
    gcmEncrypt,
    be32Bytes,
    crc32
} from './rtp_wsm_utils.js';

export class RTPSplitter {
    constructor({
        ssrc,               // uint32
        port,               // dst port
        aesKey,             // Crypto key, if empty - no encryption
        sendFn              // (ArrayBuffer) => void (ws.send)
    }) {
        this.ssrc = ssrc >>> 0;
        this.pt = 96 & 0x7F;
        this.CHUNK = 1209;
        this.port = port;
        this.aesKey = aesKey;
        this.sendFn = sendFn;

        this.seq = 1;       // инкремент на каждый RTP чанк
        this.frameSeq = 1;  // eX[1] — номер кадра-источника (16 бит значимы)
    }

    async sendRtp_(rtp12, ext8, payload, ts) {
        // ext header: profile=0x0000, length=2 words
        const extHdr = new Uint8Array([0, 0, 0, 2]);
        let out;

        if (this.aesKey) {
            const seq = ((rtp12[2] << 8) | rtp12[3]) & 0xffff;
            const iv = makeIvGcm(this.ssrc, ts, seq);

            const sealed = await gcmEncrypt(this.aesKey, iv, rtp12, payload);

            out = new Uint8Array(24 + sealed.length);
            out.set(rtp12, 0);
            out.set(extHdr, 12);
            out.set(ext8, 16);
            out.set(sealed, 24);
        } else {
            out = new Uint8Array(24 + payload.length);
            out.set(rtp12, 0);
            out.set(extHdr, 12);
            out.set(ext8, 16);
            out.set(payload, 24);
        }
        const frame = buildMediaFrame(this.ssrc, this.port, MediaType.RTP, out);
        this.sendFn(frame);
    }

    async sendFrame(vp8Frame, { ts, isKey }) {
        // CRC по полному VP8 кадру
        const crc = crc32(vp8Frame) >>> 0;

        // eX[0]=crc32 (BE), eX[1]=firstSeq (BE)
        const firstSeq = this.seq & 0xFFFF;

        const ext8 = new Uint8Array(8);
        ext8.set(be32Bytes(crc), 0);
        ext8.set(be32Bytes(this.frameSeq), 4);

        //console.log(`TX frame: frameSeq(eX1)=${this.frameSeq} crc=${crc} size=${vp8Frame.length} startSeq=${firstSeq}`);

        let pos = 0;
        let first = true;
        while (pos < vp8Frame.length) {
            const chunkLen = Math.min(this.CHUNK, vp8Frame.length - pos);

            // VP8 PD: 0x08 только в первом чанке
            const payload = new Uint8Array(1 + chunkLen);
            payload[0] = first ? 0x08 : 0x00;
            payload.set(vp8Frame.subarray(pos, pos + chunkLen), 1);
            first = false;

            const seq = this.seq & 0xFFFF;
            const rtp12 = makeRtp12(this.pt, seq, ts >>> 0, this.ssrc, /*M*/0, /*X*/1, /*CC*/0);

            await this.sendRtp_(rtp12, ext8, payload, ts);

            this.seq = (this.seq + 1) & 0xFFFF;
            pos += chunkLen;
        }

        this.frameSeq = (this.frameSeq + 1) & 0xFFFF;
    }
}
