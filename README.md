# js-client (VideoGrace Web Client)

Vanilla JS web-клиент для VideoGrace: мессенджер + конференции + realtime media (VP8/Opus) через WebSockets, WebCodecs и AudioWorklet. Без React, без сборщиков, без лишних зависимостей — только браузер и дисциплина lifecycle.

## Key features
- **Control WS (signaling):** логин, состояние контактов/участников, сообщения, unread counters, реакции/ивенты
- **Media WS:** отдельные каналы под audio/video устройства
- **Video:** RTP → VP8 decode (WebCodecs) → CanvasRenderer (contain/autoDpr)
- **Audio:** Opus decode → ring buffer (SAB) → AudioWorklet → speakers
- **Settings UI:** камера/микрофон/динамики, permissions, UI-состояния (rolled и т.п.) через Storage
- **Browser Notifications** (по политике проекта — обычно только когда `document.hidden === true`)
- **Screen Wake Lock** во время активного звонка (где поддерживается)

## Quick start (dev)
Нужен статический сервер **с заголовками COOP/COEP/CORP** (для SharedArrayBuffer / AudioWorklet и стабильной работы realtime media). Открывать `file://` не рекомендуется.

### Вариант A: Node (http-server) + headers
1) Установить (один раз):
- `npm i -g http-server`

2) Запуск:
- `http-server . -p 8080 --cors -H "Cross-Origin-Opener-Policy: same-origin" -H "Cross-Origin-Embedder-Policy: require-corp" -H "Cross-Origin-Resource-Policy: same-origin"`

Открыть:
- `http://localhost:8080/`

### Вариант B: Nginx (рекомендовано)
Пример server block:

    server {
        listen 443;                   # Необходим HTTPS
        server_name vks.company.org;  # Укажите правильный домен

        root /path/to/repo; # Укажите правильный путь
        index index.html;

        # COOP/COEP/CORP (для SAB/Worklet)
        add_header Cross-Origin-Opener-Policy same-origin always;
        add_header Cross-Origin-Embedder-Policy require-corp always;
        add_header Cross-Origin-Resource-Policy same-origin always;

        location / {
            try_files $uri $uri/ =404;
        }
        
        location = /path/to/repo/src/core/build_info.js { # Укажите правильный путь
            add_header Cache-Control "max-age=0, no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            expires off;
            etag off;
        }
    }

### 2) Открыть в браузере
https://vks.company.org

Для части API требуется secure context. http://localhost обычно подходит.

Допускается размещение не в корне сервера например /vks, если у вас уже есть витрина приложений досточно положить
js client в отдельную папку.

## Browser support

Рекомендуется современный Chromium (Chrome / Edge / Yandex).

WebCodecs / AudioWorklet / SharedArrayBuffer: зависят от браузера и контекста.
Если что-то не работает — см. `docs/DEBUGGING.md`

## Project structure

High-level:

    src/
        app.js                  # orchestration
        control/                # ControlWS + handlers
        media/                  # MediaChannel + sessions + renderers
        codecs/                 # VP8/Opus decoders
        data/                   # Storage (IndexedDB) + migrations
        ui/                     # layout + panels + overlays + monitors
    docs/
        README.md               # developer docs index

## Development principles (non-negotiable)

 - **UI render is pure:** ui/layout.js рисует DOM и шлёт команды. Рендер не делает await и не лезет в сеть/медиа/БД.
 - **Resources have lifecycle:** всё, что держит ресурсы (ws/decoder/track/worklet), имеет start/stop/close и они идемпотентны.
 - **WebCodecs contract:** каждый VideoFrame обязан быть close() во всех ветках (включая исключения).
 - **AudioWorklet:** перед new AudioWorkletNode(...) всегда await AudioShared.ensureWorklet().

## Docs

 - `docs/README.md` — индекс
 - `docs/ARCHITECTURE.md` — слои и потоки
 - `docs/PROTOCOL.md` — control/media протокол
 - `docs/MEDIA.md` — WebCodecs/Worklet/lifecycle
 - `docs/DEBUGGING.md` — типовые симптомы и фиксы

## Common troubleshooting

 - Device lists пустые в Settings: разрешения ещё не выданы → запросить permissions и обновить devices.

См. подробности: docs/DEBUGGING.md.

## License

MIT
