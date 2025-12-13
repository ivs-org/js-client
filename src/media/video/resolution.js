/**
 * resolution.js - Resolution's helpers
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

export function getResolutionValues(resolution) {
    const r = resolution >>> 0;                // unsigned
    return {
        width: r & 0xFFFF,
        height: (r >>> 16) & 0xFFFF,
    };
}

// { width, height } -> uint32
export function getResolution(width, height) {
    return (((height & 0xFFFF) << 16) | (width & 0xFFFF)) >>> 0;
}
