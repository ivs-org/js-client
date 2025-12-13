/**
 * rtp_collector.js - Collects the frame from chunks
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

function bitIsSet(n, bit) {
    return ((n >> bit) & 1) !== 0;
}
export class RTPCollector {
    constructor(receiver) {
        this.receiver = receiver;  // callback: (Uint8Array frame) => {}
        this.lastPacketSeq = 0;
        this.firstFramePacketSeq = 0;
        this.currentFrameSeq = 0;
        this.lastCRC32 = 0;
        this.size = 0;
        this.header = null;
        this.buffer = new Uint8Array(2 * 1024 * 1024); // 2MB буфер
    }

    reset() {
        this.lastPacketSeq = 0;
        this.firstFramePacketSeq = 0;
        this.currentFrameSeq = 0;
        this.lastCRC32 = 0;
        this.size = 0;
        this.header = null;
    }

    getPayloadDescriptorSize(firstTwoOctets) {
        let size = 1;
        const X = (firstTwoOctets & (1 << 0)) !== 0;
        if (X) {
            size++;
            if (firstTwoOctets & (1 << 9)) size++; // I
            if (firstTwoOctets & (1 << 10)) size++; // L
            if (firstTwoOctets & ((1 << 11) | (1 << 12))) size++; // T/K
        }
        return size;
    }

    // === Основной обработчик пакета ===
    process(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        
        // RTP header начинается с offset = 0
        const seq = view.getUint16(2, false);
        //const ssrc = view.getUint32(8, false);
        //const crc = view.getUint32(16, false);
        //const src_seq = view.getUint32(20, false);       

        // дальше полезная нагрузка — VP8 descriptor
        const rtpHeaderSize = 24; // 12 - rtp + 4 ex (crc32 & original seq)
        const payloadDescriptorSize = 1; // one byte
        
        const payload = new Uint8Array(arrayBuffer.slice(rtpHeaderSize));
        const payloadSize = payload.length;
        
        if (payloadSize === 0 || (this.lastPacketSeq && this.lastPacketSeq === seq))
            return;

        this.lastPacketSeq = seq;

        const descriptor = payload[0];
        const startBit = (descriptor >> 3) & 1;

        if (startBit) {
            this.firstFramePacketSeq = seq;

            // Если у нас уже есть собранный фрейм, отправляем его
            if (this.size > 0) {
                const frame = this.buffer.slice(0, this.size);
                this.receiver(frame);
            }

            this.size = 0;
        }

        if (payloadSize > payloadDescriptorSize) {
            const dataSize = payloadSize - payloadDescriptorSize;
            const rel = (seq - this.firstFramePacketSeq) & 0xffff;
            const pos = rel * 1209; // SPLITTED_PACKET_SIZE (примерно MTU)

            if (rel > 4096 || pos + dataSize > this.buffer.length) {
                console.warn("RTPCollector buffer overflow/drop");
                return;
            }

            this.buffer.set(payload.subarray(payloadDescriptorSize), pos);
            this.size += dataSize;
        }
    }
}
