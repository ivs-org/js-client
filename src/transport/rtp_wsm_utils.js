/**
 * rtp_wsm_utils.js - Base RTP / Cipher helpers
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

// ===== enums =====
export const WsBinaryMsgType = { Media: 1, Blob: 2 };
export const MediaType = { RTP: 1, RTCP: 2 };

// ===== utils =====
export function hexToU8(hex) {
    const h = hex.trim();
    if (!/^[0-9a-fA-F]+$/.test(h) || h.length !== 64) {
        throw new Error(`AES-256 key must be 64 hex chars, got ${h.length}`);
    }
    const u = new Uint8Array(h.length / 2);
    for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16);
    return u;
}
export async function importAesGcmKey(hex) {
    const raw = hexToU8(hex);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function concatU8(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
}

// ===== RTP helpers =====

// big-endian helpers
export function be16(v) { return [(v >>> 8) & 0xFF, v & 0xFF]; }
export function be32Bytes(v) {
    v >>>= 0;
    return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
}

export function makeRtp12(pt, seq, ts, ssrc, m = 0, x = 0, cc = 0) {
    // Byte0: V=2,P=0,X=?,CC=?
    const b0 = 0x80 | (x ? 0x10 : 0) | (cc & 0x0F);
    const b1 = (m ? 0x80 : 0) | (pt & 0x7F);
    const out = new Uint8Array(12);
    out[0] = b0; out[1] = b1;
    out.set(be16(seq), 2);
    out.set(be32Bytes(ts), 4);
    out.set(be32Bytes(ssrc), 8);
    return out;
}

// длина RTP-заголовка с учётом CSRC и extension’ов
export function rtpHeaderLen(pktU8) {
    if (pktU8.length < 12) return pktU8.length;
    const b0 = pktU8[0];
    const cc = b0 & 0x0F;
    const x = (b0 & 0x10) !== 0;
    let off = 12 + cc * 4;
    if (x) {
        if (pktU8.length < off + 4) return pktU8.length;
        const dv = new DataView(pktU8.buffer, pktU8.byteOffset, pktU8.byteLength);
        const extLenWords = dv.getUint16(off + 2, false); // BE
        off += 4 + extLenWords * 4;
    }
    return Math.min(off, pktU8.length);
}

// IV = SSRC(4) | TS(4) | SEQ(2) | 0x0000(2)
export function makeIvGcm(ssrc, ts, seq) {
    const iv = new Uint8Array(12);
    iv[0] = (ssrc >>> 24) & 0xff; iv[1] = (ssrc >>> 16) & 0xff; iv[2] = (ssrc >>> 8) & 0xff; iv[3] = ssrc & 0xff;
    iv[4] = (ts >>> 24) & 0xff; iv[5] = (ts >>> 16) & 0xff; iv[6] = (ts >>> 8) & 0xff; iv[7] = ts & 0xff;
    iv[8] = (seq >>> 8) & 0xff; iv[9] = seq & 0xff; iv[10] = 0; iv[11] = 0;
    return iv;
}

// ===== AES-GCM (payload only) =====
export async function gcmEncrypt(key, iv, aad12, plaintextU8) {
    const ctBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad12, tagLength: 128 },
        key,
        plaintextU8
    );
    return new Uint8Array(ctBuf); // ciphertext || tag
}
export async function gcmDecrypt(key, iv, aad12, cipherTagU8) {
    const ptBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aad12, tagLength: 128 },
        key,
        cipherTagU8
    );
    return new Uint8Array(ptBuf);
}

// ===== WSM binary helpers (10-byte header, BE) =====
// [0]=msg_type(1), [1]=flags(1), [2..5]=ssrc(u32BE), [6..7]=port(u16BE), [8..9]=media_type(u16BE), then payload
export function buildMediaFrame(ssrc, port, mediaType, payload) {
    const p = payload instanceof Uint8Array ? payload
        : payload instanceof ArrayBuffer ? new Uint8Array(payload)
            : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);

    const out = new Uint8Array(10 + p.length);
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    out[0] = WsBinaryMsgType.Media;
    out[1] = 0;
    dv.setUint32(2, ssrc >>> 0, false);
    dv.setUint16(6, port & 0xffff, false);
    dv.setUint16(8, mediaType & 0xffff, false);
    out.set(p, 10);
    return out;
}

export function parseMediaFrame(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8.length < 10) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const msgType = u8[0];
    const flags = u8[1];
    const ssrc = dv.getUint32(2, false);
    const port = dv.getUint16(6, false);
    const media = dv.getUint16(8, false);
    const payload = u8.subarray(10);
    return { msgType, flags, ssrc, port, mediaType: media, payload };
}

// RTCP APP
export function serializeRTCP_APP(ssrc, name, payload = new Uint8Array(0)) {
    const PT_APP = 204, V = 2, P = 0, COUNT = 0;
    const headerSize = 4, bodySize = 8 + payload.length, total = headerSize + bodySize;
    const out = new Uint8Array(total); const dv = new DataView(out.buffer);
    let b0 = 0; b0 |= (V & 3) << 6; b0 |= (P & 1) << 5; b0 |= (COUNT & 0x1F);
    dv.setUint8(0, b0); dv.setUint8(1, PT_APP); dv.setUint16(2, (total / 4) - 1, false);
    dv.setUint32(4, ssrc >>> 0, false); dv.setUint32(8, name >>> 0, false);
    out.set(payload, 12);
    return out;
}

// CRC32
const CRC32_TAB = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        t[i] = c >>> 0;
    }
    return t;
})();

/**
  * @param {Uint8Array} data  - входные байты
 * @param {number} seed      - начальный CRC (u32)
 * @returns {number}         - CRC (u32)
 */
export function crc32(bytes, seed = 0) {
    let c = (seed ^ 0xFFFFFFFF) >>> 0;     // init XOR
    for (let i = 0; i < bytes.length; i++) {
        c = CRC32_TAB[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;         // final XOR
}