# @videograce/client

[![npm](https://img.shields.io/npm/v/@videograce/client)](https://www.npmjs.com/package/@videograce/client)
[![npm](https://img.shields.io/npm/dm/@videograce/client)](https://www.npmjs.com/package/@videograce/client)

Клиентская библиотека VideoGrace для подключения к узлам связи (WSS), обмена сообщениями и медиа в браузере. Без сборки, чистый ESM.

- Сайт: https://videograce.ru
- GitHub: https://github.com/ivs-org/

---

## Быстрый старт

### Вариант A — через npm

```bash
npm i @videograce/client

// ESM
import { version /*, ...API */ } from '@videograce/client';

console.log('VideoGrace client', version);
```

### Вариант B — без Node, прямо из CDN (jsDelivr)

```html
<script type="importmap">
{
  "imports": {
    "@videograce/client": "https://cdn.jsdelivr.net/npm/@videograce/client@latest/dist/index.js"
  }
}
</script>

<script type="module">
  import { version /*, ...API */ } from "@videograce/client";
  console.log('VideoGrace client', version);
</script>
```

CDN отдаёт файлы из npm. Никаких сборщиков, Babel и прочего не требуется.

## Требования

Современный браузер с поддержкой ES modules.

HTTPS и пользовательский жест для доступа к микрофону/камере.

## Совместимость/подход

ESM-only. Если нужен CJS/UMD — создайте issue в репозитории.

Минимум зависимостей. Рекомендуемый способ подключения — importmap/CDN или через npm в вашем бандлере.

## Версионирование

SemVer: MAJOR.MINOR.PATCH. Минорные версии могут добавлять API; мажор — ломающие изменения.

## Безопасность

Уязвимость или подозрение — напишите на security@videograce.ru

## Лицензия

MIT
