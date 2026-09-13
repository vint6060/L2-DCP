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
- LLM adapter с безопасным local summary по умолчанию. Реальный POST выполняется только к endpoint, явно введенному пользователем; ключи в клиенте не хранятся.

## Структура

- `index.html`, `styles.css`, `app.js` — UI и состояние панели.
- `parser.js` — чистые parser/normalizer функции.
- `worker.js` — пакетное чтение локальных файлов.
- `test/parser.test.js` — тесты vendor detection, нормализации, summary и CSV.

Parser намеренно эвристический: синтаксис зависит от модели и версии firmware. Для production-использования нужны fixtures по конкретным моделям, versioned schema и серверный LLM gateway с аутентификацией.
