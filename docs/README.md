# js-client — Developer Docs

## About
Web client для VideoGrace: Control WS (сигналинг) + Media WS (RTP/RTCP поверх WSM) + WebCodecs (VP8/Opus) + AudioWorklet + CanvasRenderer.

## Requirements
- Modern Chromium (Chrome / Edge / Yandex) recommended.
- HTTPS recommended (localhost обычно ок).
- Camera/Mic permissions (для enumerateDevices с label).

## Run locally
1) Start static server in repo root:
- `python -m http.server 8080`
- or любой другой static server

2) Open:
- `http://localhost:8080/` (или ваш index.html entrypoint)

## Quick test flow
1) Login
2) Join conference / open chat
3) Start/stop:
   - Camera
   - Screen share
   - Mic
4) Check:
   - audio playback (remote mic)
   - video render (remote video)
   - reconnect after background / airplane mode

## Project structure (high level)
- `src/control/` — ControlWS + handlers
- `src/media/` — MediaChannel + sessions + renderer
- `src/data/` — Storage (IndexedDB) + settings
- `src/ui/` — layout + panels + overlays

## Docs index
- ARCHITECTURE.md — слои и потоки
- STATE.md — appState + правила реактивности
- STORAGE.md — IndexedDB stores + settings
- MEDIA.md — WebCodecs + AudioWorklet + lifecycle
- PROTOCOL.md — ControlWS/MediaWS сообщения
- DEBUGGING.md — типовые баги и диагностика

## Conventions
- Любые ресурсы (ws/decoder/track/worklet) должны иметь `start/stop` идемпотентные.
- Любой VideoFrame MUST be `close()` (включая исключения).
- AudioWorklet: `await AudioShared.ensureWorklet()` перед `new AudioWorkletNode(...)`.
