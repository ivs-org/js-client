# Architecture

## Goals
- Stable realtime media (VP8/Opus) in browser
- Predictable lifecycle (F5/background/reconnect)
- Minimal dependencies (vanilla + ES modules)
- UI stays simple and deterministic

## Layers
### 1) Control (signaling)
- `ControlWS` — login, device events, messages, presence
- handlers parse JSON and update Storage/state

### 2) Media (realtime)
- `MediaChannel` per remote device stream (video/audio)
- Video: RTPCollector -> VP8Decoder -> CanvasRenderer
- Audio: OpusDecoder -> ring buffer (SAB) -> AudioWorklet -> destination

### 3) Data
- `Storage` = IndexedDB + in-memory map
- Settings as first-class entity (UI state, devices prefs)

### 4) UI
- `ui/layout.js` — single main renderer
- Panels: settings, contacts, chat, etc.
- Overlays: modal/confirm

## Data flow
### ControlWS -> UI
1) ws message -> handler
2) update Storage and/or appState
3) `subscribe()` triggers re-render (layout)

### Media WS -> Video
1) Media WS binary frame -> parseMediaFrame
2) RTPCollector -> VP8Decoder.decode
3) decoded VideoFrame -> createImageBitmap -> CanvasRenderer.drawBitmapContain
4) always close bitmap + frame

### Media WS -> Audio
1) Media WS binary frame -> opus decode -> AudioData
2) AudioData -> Float32Array planes
3) push to SAB ring
4) AudioWorklet reads ring -> outputs to destination

## Lifecycle rules
- `start()` and `stop()` are idempotent for all long-lived components.
- UI render MUST NOT perform async side-effects.

## Error policy
- `warn` when user-action required or data loss risk
- `error` only when component cannot operate
- repeated `start()` should be `debug`, not `warn`

## Known constraints
- Wake Lock supported only in certain browsers/contexts
- Audio output device selection depends on setSinkId support
- Background throttling on mobile is expected; we reconnect/resume
