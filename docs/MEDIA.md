# Media subsystem

## Components
- `MediaChannel` — remote audio/video render + media WS
- `CamSession` — local camera capture
- `ScreenSession` — local screen capture
- `CanvasRenderer` — draw bitmap contain/cover, DPR safe
- `VP8Decoder` / `OpusDecoder`

## Video pipeline
1) Media WS frame -> parseMediaFrame
2) RTP (possibly decrypt) -> RTPCollector
3) VP8Decoder.decode -> VideoFrame
4) createImageBitmap(VideoFrame) -> ImageBitmap
5) CanvasRenderer.drawBitmapContain
6) finally: bitmap.close(), frame.close()

### Critical rule
- Every VideoFrame MUST be closed in all code paths.
- If decoder stores `_lastFrame`, it MUST close previous frame on overwrite.

## Audio pipeline
1) Media WS -> Opus decode -> AudioData
2) copyTo Float32Array -> deinterleave to channel arrays
3) push to ring buffer (SharedArrayBuffer)
4) AudioWorklet reads ring -> output to destination

### AudioWorklet rule
- MUST `await AudioShared.ensureWorklet()` before creating `AudioWorkletNode`.
- Worklet URL should be relative to module via `new URL(..., import.meta.url)`.

## Reconnect policy
- Media WS reconnect after close unless intentionally closed
- Background:
  - optionally pause video decode/ws to save battery
  - resume: re-init decoder + force keyframe

## Device selection
- camera/mic deviceId from settings
- fallback to default if exact deviceId fails

## Wake lock
- Acquire Screen Wake Lock during active call
- Release on hangup/leave
- Re-acquire after visibilitychange (on foreground)

## Known performance knobs
- Video: avoid parallel createImageBitmap in-flight
- CanvasRenderer: observeResize, autoDpr to avoid layout thrash
- Audio: ring capacity, drop strategy (avoid growing latency)
