# ROO Network Configuration Dashboard

Локальный dependency-free MVP для анализа конфигураций Ethernet-коммутаторов FTTB/L2+.

## Запуск

Из каталога `network-dashboard/` нужен любой статический HTTP-сервер, потому что ES modules и Web Worker не запускаются надежно через `file://`:

```bash
cd network-dashboard
python3 -m http.server 8080
```

Откройте <http://localhost:8080>.

## Тесты и проверки

```bash
cd network-dashboard
npm test
npm run check
git diff --check
```

У проекта нет runtime-зависимостей и внешних CDN. `npm test` использует встроенный Node test runner.

## Что реализовано

- Загрузка `.cfg/.conf/.txt` файлов, папки через `webkitdirectory` и drag-and-drop.
- Web Worker с пакетной обработкой по 40 файлов и прогрессом, чтобы не блокировать интерфейс на больших выгрузках.
- Эвристические профили SNR, D-Link, FiberHome, Edgecore, Eltex и Generic fallback.
- Нормализация hostname, vendor/model, интерфейсов, VLAN, access/trunk, state/speed, storm control, port isolation, STP/MSTP, ACL, PoE и неизвестных директив.
- KPI, поиск, фильтры, таблица устройств, drill-down по вкладкам и JSON/CSV экспорт.
- Поля `confidence` (`heuristic`, `inferred`, `unknown`) и предупреждения о различиях firmware.
- Интерактивная LLM-панель для сводки и выбранного устройства. По умолчанию endpoint не настроен и используется локальный demo fallback.

## Структура

- `index.html`, `styles.css`, `app.js` — UI и состояние панели.
- `parser.js` — чистые parser/normalizer функции.
- `worker.js` — пакетное чтение локальных файлов.
- `llm-adapter.js` — endpoint adapter, локальный fallback и ограниченный нормализованный payload.
- `test/parser.test.js` — тесты vendor detection, нормализации, summary/CSV, demo preload и LLM payload/adapter.

Parser намеренно эвристический: синтаксис зависит от модели и версии firmware. Для production-использования нужны fixtures по конкретным моделям, versioned schema и серверный LLM gateway с аутентификацией.

## Подключение LLM backend

GitHub Pages остается полностью статическим: ключи провайдера никогда не помещаются в браузер, а запросы по умолчанию не выполняются. Для подключения backend proxy задайте endpoint одним из способов:

```html
<html data-llm-endpoint="https://your-domain.example/api/l2-analysis">
```

или до загрузки `app.js` установите `window.L2DCP_CONFIG = { llmEndpoint: 'https://...' }`.

Proxy должен принимать `POST` JSON с полями `version`, `scope`, `summary`, `devices` и `deviceCount`, а вернуть JSON вида `{ "text": "..." }` (также поддерживаются `analysis` и `answer`). Настройте на proxy CORS только для домена Pages, а секреты храните в server-side environment/secrets. Не проксируйте сырые конфигурации: клиент отправляет только ограниченный нормализованный payload размером до 12 KB.
