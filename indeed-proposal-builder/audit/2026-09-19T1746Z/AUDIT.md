# Аудит фронтенда «Конструктор КП»

**Дата аудита:** 2026-09-19 (UTC)  
**Путь проекта:** `/workspace/indeed-proposal-builder`  
**Папка отчёта:** `indeed-proposal-builder/audit/2026-09-19T1746Z/`  
**Матрица:** [`AUDIT_MATRIX.csv`](./AUDIT_MATRIX.csv)  
**Git:** ветка `cursor/indeed-proposal-builder-f84c`, commit `bdce5142dc46fdc4770d31cac1fe1ba191b91822`  
**Незакоммиченные изменения на старте:** только `uploads/` (вне проекта). После аудита добавлена папка `audit/` (материалы проверки).  
**Исходный промпт `cursor_frontend_prompt.md`:** не найден в репозитории. Scope взят из текста задания аудита, README, `reference/1.html` и встроенных данных. Полная трассировка исходного промпта как файла недоступна.

### Ответы на контрольные вопросы аудита

1. **Полностью и подтверждено:** 4 шага, демо PAM25, контрольные суммы §10 (oracle+SUT), черновик localStorage с date-only, DOCX OOXML, needs_rule для null/6 мес, SKU без догадок для 46/77, typecheck/lint/test/build.
2. **Частично:** адаптив 390, collapsed sidebar, parser leftover-токены, a11y, corrupt-storage UX, PDF (кнопка есть, файл нет), соответствие HTML по плотности.
3. **Демо/имитация:** `mode=demo`, локальный calculator/parser/catalog JSON, provenance S08, нет live Excel/API.
4. **Выглядит работающим, но нет:** PDF («Скачать КП в PDF» → toast/`createPdf` fail); пункты меню «скоро» disabled (ожидаемо).
5. **Ломающиеся сценарии:** PDF; НДС в summary 1100 при двух альтернативах; риск stale DOCX после правки без пересборки из свежего store.
6. **HTML:** метрики колонок/цвета близки на 1792; pixel-perfect и высота canvas — нет; цены HTML намеренно не копируются.
7. **4 шага + черновик + DOCX:** да; **PDF:** нет.
8. **Расчёт:** PAM UL/CS 12/perp ordinary|FSTEC произвольные qty; CM Windows+Agent; ITDR Mon+MFA; AM большинство модулей; RL/6–36/CM multi/WL annual — needs_rule.
9. **Риск неверных сумм/артикулов:** UI VAT sum; stale export; неподтверждённые SKU помечены unresolved (ок); выдуманных 46/77 SKU нет.
10. **Scope vs недоделка:** backend/меню — scope; PDF/VAT summary/stale export/sidebar/390 scroll — недоделка.
11. **Демо:** можно с оговоркой по PDF; **клиенту:** нельзя.
12. **Сначала:** PDF → VAT по альтернативам → stale export → sidebar/390; критерии в §4 и §11.

## 1. Краткий вывод

Приложение **запускается**, собирается, проходит unit/e2e smoke, воспроизводит оболочку и демо-сценарий PAM с **корректными контрольными суммами** (не ценами из HTML). Четыре шага, черновик и DOCX в целом работают.  

**Критично для демонстрации экспорта:** кнопка PDF **не скачивает файл** (ошибка `pdfMake.createPdf is not a function`).  

**Для выдачи реального КП клиенту приложение не готово** (осознанный demo-режим, неподтверждённые SKU, локальный адаптер).

| Оценка | Вердикт |
|---|---|
| Демонстрация фронтенда | **Условно да** — путь шагов/расчёт/DOCX/черновик ок; PDF сломан |
| Подключение backend | **Частично** — есть интерфейсы сервисов и `mode: 'demo'\|'api'` |
| Реальная выдача КП | **Нет** |

## 2. Проверяемая версия и окружение

| Параметр | Значение |
|---|---|
| Node.js | v22.14.0 |
| npm | 10.9.7 |
| Vite | ^8.3.0 (lock) |
| React | ^19.2.8 |
| TypeScript | ~5.9.3 |
| docx | ^9.7.1 |
| pdfmake | ^0.3.11 |
| Dev-сервер | `http://127.0.0.1:43123` (отвечал 200) |
| Режим | локальное демо, без внешних API с данными заказчика |
| Макет | `reference/1.html` (копия вложения `uploads/1_4223.html`) |

Команды: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`.

## 3. Реализованные возможности (подтверждено)

| Возможность | Статус | Доказательство |
|---|---|---|
| Dev/typecheck/lint/test/build | Проверено — работает | `logs/commands.log`: все EXIT:0; 23 unit-теста |
| Оболочка, stepper, 4 шага | Проверено — работает | Скриншоты `01`–`08`, e2e |
| Демо PAM25 ФСТЭК, суммы 3 782 150 / 7 093 250 | Проверено — работает | `layout-1792.json`, harness, unit |
| Контрольные PAM/ITDR/CM (таблица §10) | Проверено — работает | `logs/audit-harness.log`, независимый oracle |
| PAM package `saleQuantity=1` | Проверено — работает | harness |
| `certified=null` → без цены, needs_rule | Проверено — работает | harness |
| Срок 6 мес → needs_rule | Проверено — работает | harness |
| Комплект 2×3050, НДС 1100; скидка не на комплект | Проверено — работает | harness |
| SKU: 60/CS10 observed; 46/77/kit unresolved | Проверено — работает | harness + `catalogService` |
| Черновик save/restore, date-only, validity месяц | Проверено — работает | `logs/restore-result.json`, `draft-raw.json` |
| DOCX OOXML с таблицами и кириллицей | Проверено — работает | `exports/audit-pam46-fstec.docx`, `browser-DEMO_draft.docx` |
| Демо-баннер / mode=demo в UI и документе | Проверено — работает | preview, DOCX |
| Меню вне scope disabled | Проверено — работает | 6× `.nav-item.soon` |
| XSS как текст, не HTML | Проверено — работает | нет `dangerouslySetInnerHTML` в src; React text binding |
| Каталог 31 / блоки 35 / SKU 39 | Проверено — работает | подсчёт JSON |
| Независимость конфигураций альтернатив | Проверено — работает | harness + unit |

## 4. Ошибки по приоритету

### P1-01 — PDF-экспорт не работает
- **Категория:** ошибка реализации  
- **Сценарий:** «Скачать КП в PDF»  
- **Шаги:** открыть приложение → нажать PDF  
- **Ожидалось:** скачивание `.pdf` с кириллицей  
- **Получено:** download не стартует; toast `pdfMake.createPdf is not a function`  
- **Доказательство:** `logs/pdf-result.json`, `logs/pdf-probe.json`; Node harness: `Cannot redefine property: vfs`  
- **Причина:** некорректная инициализация pdfmake/vfs в `src/services/pdfExporter.ts` (`getPdfMake`, присвоение `vfs`, вызов `createPdf`)  
- **Исправление:** поправить импорт pdfmake 0.3 + vfs_fonts; покрыть e2e download  
- **Проверка:** toast отсутствует; файл `%PDF`, кириллица читаема  

### P1-02 — НДС комплекта суммируется по альтернативам в панели итогов
- **Категория:** ошибка реализации  
- **Сценарий:** две альтернативы, по 1 комплекту  
- **Ожидалось:** НДС показываться **по каждой альтернативе** (550 ₽), без сложения «покупки обеих»  
- **Получено:** `комплект — НДС в т.ч. 1 100,00 ₽` на демо (550+550)  
- **Доказательство:** `logs/layout-1792.json` → `sums[2]`  
- **Причина:** `vatSummary` в `StepConfiguration.tsx` суммирует kit VAT по всем `options`  
- **Исправление:** показывать НДС в контексте активной/каждой альтернативы отдельно  
- **Проверка:** демо → в итоге 550 ₽ на альтернативу, не 1100 общим числом без пояснения  

### P1-03 — Риск/факт рассинхрона экспорта с UI (stale state)
- **Категория:** ошибка реализации (частично подтверждена артефактом)  
- **Сценарий:** после смены количества/метаданных скачать DOCX  
- **Ожидалось:** файл = текущий preview  
- **Получено:** `exports/browser-DEMO_draft.docx` содержит `Исх. —`, дату `19.09.2026`, PAM **46** UL, тогда как UI после restore показывал `КП-AUDIT-UI-001`, `15.06.2026`, qty **77** CS (`06-after-restore.png`)  
- **Доказательство:** сравнение DOCX-текста и скриншота `06`; код `BuilderProvider.tsx` `exportDocx`: `dispatch(RECALCULATE_ALL)` затем `buildProposalDocument(state.proposal)` из замыкания  
- **Причина:** подтверждена опасная схема со stale closure; полное стабильное воспроизведение «всегда» не зафиксировано отдельным минимальным тестом  
- **Исправление:** строить документ из результата синхронного `calculateOptionSync`/актуального store без опоры на устаревший closure; e2e: изменить qty → сразу export → assert  
- **Проверка:** qty 77 в UI ⇒ 77 в DOCX/PDF  

### P2-01 — Свёрнутый sidebar ≈196–215px вместо ~76px
- **Категория:** ошибка реализации  
- **Ожидалось:** ~76px  
- **Получено:** ≈196 px (`logs/ui-assertions.json` `collapsedW`); в отдельных замерах до ≈215 px  
- **Доказательство:** измерение Playwright; скрин `02-sidebar-collapsed-1792.png`  
- **Исправление:** проверить применение класса `sidebar-collapsed` и ширину grid-колонки  

### P2-02 — Горизонтальный скролл страницы на 390×844
- **Категория:** ошибка реализации / адаптивность  
- **Доказательство:** `scroll: true` при viewport 390  
- **Исправление:** `min-width: 0`, перенос таблиц, drawer  

### P2-03 — Parser: `PAM25` оставляет мусорный токен
- **Категория:** ошибка реализации (частичная)  
- **Получено:** qty=25 и cert распознаны, но `unk=PAM25`  
- **Доказательство:** harness PARSE `"PAM25 FSTEC"`  
- **Исправление:** удалять compact-match из текста до leftover-scan  

### P2-04 — Обломки токенов «на|ей» после «пользователей»
- **Категория:** ошибка реализации  
- **Доказательство:** PARSE `"PAM ФСТЭК на 77 пользователей"` → `unk=на|ей`  

### P2-05 — Дублирование issues в расчёте
- **Категория:** ошибка реализации (косметика/шум)  
- **Получено:** `certification_unspecified` / `kit_without_cert` по два раза  
- **Доказательство:** harness  

### P2-06 — Раскладка vs HTML: плотность/позиция блоков
- **Категория:** улучшение / частичное соответствие  
- **Факт:** на 1792 ширины sidebar/topbar/preview/summary/цвета совпали с макетом (`layout-1792.json`: 224 / 58 / 520 / 305, `--red #e30613`). При этом структура страницы более «высокой» (structure + actions), итоги/preview читаются иначе, чем плотный canvas 1024px HTML.  
- **Влияние:** узнаваемость шага 2 высокая, pixel-perfect нет  

### P3-01 — Oxlint react-only-export-components
- Предупреждения в `BuilderProvider.tsx`, на поведение не влияют  

## 5. Матрица поддержанных конфигураций

| Продукт/метрика | Платформа | Вид/срок | Версия | Модули | Расчёт | SKU | Ограничение |
|---|---|---|---|---|---|---|---|
| PAM UL | — | sub 12 / perp | ordinary/FSTEC | base | полный | только точное совпадение (напр. UL60) | 46/77 без SKU |
| PAM CS | — | sub 12 / perp | ordinary/FSTEC | base | полный | CS10 observed | — |
| PAM RL | — | любой | любой | — | needs_rule | unresolved | заявлено |
| PAM + kit | — | — | FSTEC | kit qty | 3050/НДС22% | sku null | ok |
| PAM AAPM/SQL | — | — | — | catalog | needs_rule | unresolved | demo |
| AM base+modules | — | sub12/perp | ordinary | большинство | полный | observed AM-* | WL annual = null price |
| CM Windows+Agent | windows | sub12/perp | ordinary | agent | полный | CM-* | — |
| CM multiplatform | multi | — | — | — | needs_rule | — | заявлено |
| ITDR Mon+MFA | — | sub12/perp | ordinary | оба | полный (без 0.533) | ITDR* | cert → warning |
| Срок 6/24/36 | — | sub ≠12 | — | — | needs_rule | PF-01060010 только для точного lookup | нет универсального правила |

## 6. Ограничения демо и неизвестные правила

**Ожидаемые (честно обозначены):** mode=demo, provenance S08, нет live Excel/backend/auth, меню-заглушки, неизвестные SKU, needs_rule для RL/CM multi/доп.поддержки/нестандартных сроков, WL annual.  

**Скрывающие UX-проблемы:** сумма НДС 1100 по двум альтернативам выглядит как единый налог сделки (P1-02).  

**Бизнес-решения вне фронта:** генерация SKU 46/77, правила 6/24/36, PAM RL, CM multi, сертификация ITDR.

## 7. Соответствие HTML и адаптивность

| Viewport | Результат |
|---|---|
| 1792×1024 | Близко к макету по метрикам колонок/цветам; демо-суммы корректные; скрин `01` |
| 1440×900 | Без горизонтального скролла всего документа (`layout-responsive` на restore-сценарии); скрин `09` |
| 1280×800 | Скрин `10`; перестройка колонок |
| 390×844 | Есть mobile menu; **есть горизонтальный скролл** страницы |

Свёрнутое меню: ожидание ~76px, факт ~215px (P2-01).

## 8. Расчёты и экспорт

Независимый oracle и SUT совпали на всех контрольных строках §10 (см. `audit-harness.log`).  

DOCX (harness): валидный OOXML, две таблицы PAM46 ФСТЭК, итоги 6 741 038 и бессрочная по формуле, комплект 3050, НДС-примечание, без `{{vars}}`.  

PDF: **не получен** ни в Node, ни в браузере.

## 9. Результаты команд

| Команда | Результат |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK + 4 warnings |
| `npm run test` | 23 passed |
| `npm run build` | OK (предупреждения chunk size) |
| `npm run test:e2e` (smoke) | ранее OK |
| Playwright audit restore | OK |
| Playwright PDF | FAIL |

Логи: `logs/commands.log`, `logs/audit-harness.log`, `logs/playwright.log`, `logs/pdf-result.json`, `logs/restore-result.json`.

## 10. Непроверенные области

| Область | Причина |
|---|---|
| Визуальный pixel-diff с HTML side-by-side | Нет автоматизированного image-diff; сравнение по метрикам+скринам |
| Открытие DOCX в MS Word/LibreOffice GUI | Только структурный разбор OOXML + текстовая экстракция |
| PDF визуально | Файл не создаётся |
| Переполнение localStorage / QuotaExceeded | Не имитировалось |
| Параллельные быстрые клики export | Косвенный артефакт P1-03, отдельный stress не гонялся |
| Полный прогон всех parser-фраз через UI | Через domain harness да; UI — выборочно |
| Исходный `cursor_frontend_prompt.md` | Файл отсутствует |

## 11. План исправлений

### До демонстрации
1. Починить PDF (`pdfExporter.ts`) + e2e download.  
2. Развести НДС/итоги по альтернативам (не суммировать kit VAT).  
3. Убрать stale export: документ только из актуального состояния; e2e qty→export.  
4. Починить ширину collapsed sidebar.  

### Перед реальной выдачей КП
5. Backend calculator + утвержденный каталог SKU.  
6. Закрыть needs_rule ветки с владельцем прайса.  
7. Режим «готово к выпуску» vs demo draft.  
8. Адаптив 390 без page-level horizontal scroll.  

### После MVP / можно оставить
9. Parser leftover tokens.  
10. Дедуп issues.  
11. Pixel-perfect к HTML.  

### Не считать багом текущего MVP
- Отсутствие backend/Excel live.  
- Disabled пункты меню.  
- Неизвестный SKU для 46/77 при честной пометке.

---

**Изменения репозитория аудитом:** добавлена только `indeed-proposal-builder/audit/` (+ временные e2e-файлы удалены). `npm run build` обновил локальный `dist/` (gitignore). Продуктовый `src/` не менялся.
