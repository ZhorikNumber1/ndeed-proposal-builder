# AUDIT REPORT — Конструктор КП «Индид»

**Дата аудита:** 2026-10-11  
**Проект:** `/workspace/indeed-proposal-builder`  
**Ветка:** `cursor/indeed-proposal-builder-f84c`  
**Базовый коммит:** `895213b` — `fix: restore alternatives mode switching and price WL as LL`  
**Тип работы:** анализ только; исходный код, конфигурации и git **не изменялись** в ходе этого аудита.  
**Сопутствующий документ:** [`MASTER_CONTEXT_FOR_GPT6.md`](./MASTER_CONTEXT_FOR_GPT6.md)

**Исторические аудиты (не заменяют текущий):**
- `audit/2026-09-19T1746Z/AUDIT.md` — исходный браузерный аудит (часть P1 устарела)
- `audit/2026-09-19T1808Z/FIX_REPORT.md` — закрытие PDF / НДС / stale export / UI / parser

---

## 1. Executive Summary

Проект — **локальный frontend-MVP** конструктора коммерческих предложений (КП) для продуктов Indeed (PAM, AM, CM, ITDR). Стек: Vite 8 + React 19 + TypeScript 5.9. Backend, БД, auth и live Excel **отсутствуют**. Расчёт — `mode: 'demo'` по извлечённым правилам S08 (`src/domain/pricing.ts`, `src/domain/calculateOption.ts`). Черновики — localStorage v2. Справочник артикулов — статический JSON (~10 297 записей) после импорта Excel.

**Состояние на `895213b`:**
- Основной сценарий (главная → 4 шага → расчёт → PDF/DOCX) реализован и покрыт unit/e2e.
- Критические дефекты сентябрьского аудита (PDF, НДС по альтернативам, stale export) **исправлены** (см. FIX_REPORT + текущий код).
- Недавние фиксы: пайплайн search→quote, alternatives mode, WL=LL pricing.
- Для **реальной выдачи КП клиенту** приложение **не готово**: demo-режим, неполные правила (PAM RL/modules, CM multi, non-12m), часть SKU unresolved (PAM 46/77).

| Критерий | Вердикт |
|---|---|
| Демонстрация фронтенда | Да (с оговоркой demo) |
| Реальная выдача КП | Нет |
| Backend / API / БД | Нет (только порты-типы) |
| Полнота бизнес-правил | Частичная (явные `needs_rule`) |

---

## 2. Состав и архитектура проекта

### 2.1 Назначение и бизнес-задачи

Позволить менеджеру:
1. Создать/открыть черновик КП.
2. Заполнить реквизиты.
3. Сконфигурировать продукты (вручную или парсером свободного текста).
4. Получить демо-расчёт с ценами S08 и попыткой резолва SKU.
5. Предпросмотреть и скачать DOCX/PDF с демо-баннером.

### 2.2 Стек и версии

| Технология | Версия (package.json) |
|---|---|
| React / React DOM | ^19.2.8 |
| react-router-dom | ^7.18.4 |
| Vite | ^8.3.0 |
| TypeScript | ~5.9.3 |
| pdfmake / pdfjs-dist | ^0.3.11 / ^4.10.38 |
| docx / file-saver | ^9.7.1 / ^2.0.5 |
| Vitest / Playwright / oxlint | ^5.0.1 / ^1.58.2 / ^1.81.0 |
| xlsx (dev, импорт) | ^0.18.5 |
| shadcn/ui | **не используется** (кастомный CSS) |

Точка входа: `src/main.tsx` → `BrowserRouter` → `App`.  
Dev: `npm run dev` → `http://127.0.0.1:43123`.

### 2.3 Архитектурный подход

Классический **layered SPA** без сервера:

```
UI (pages/features) → app state (BuilderProvider + reducer)
                   → domain (normalize, calculate, document, validate)
                   → services (catalog/SKU, drafts, export)
                   → static data (JSON/TS fixtures)
```

Порты объявлены в `src/domain/types.ts` (`CalculatorService`, `CatalogService`, `DraftRepository`, `ExportService`) и реэкспортируются из `src/services/contracts.ts`. UI калькулирует через прямой вызов `calculateOptionSync`, а не через `createDemoCalculatorService`.

### 2.4 Git

| Параметр | Значение |
|---|---|
| Активная ветка | `cursor/indeed-proposal-builder-f84c` |
| Tip | `895213b` |
| `main` | `f2322fa` — пустой init («Initialize project») |
| Tracking | `origin/cursor/indeed-proposal-builder-f84c` |

Недавние коммиты (новые → старые): alternatives/WL → quote pipeline → pdfmake notes → constructor/articles load → Excel import.

### 2.5 Карта значимых директорий

| Путь | Назначение | Основные файлы | Зависимости | Что сломается при изменении |
|---|---|---|---|---|
| `src/app/` | Маршруты-обёртка, state, shell workspace | `App.tsx`, `BuilderProvider.tsx`, `builderReducer.ts`, `Workspace.tsx` | domain, services, features | Весь конструктор, autosave, export |
| `src/pages/` | Страницы маршрутов | `HomePage`, `ArticlesPage`, `BuilderPage` | draftCollection, AppShell | Навигация, список КП |
| `src/features/` | Шаги 1–4 + preview/export UI | `StepDetails`, `StepConfiguration`, `StepCalculation`, `DocumentPreview` | BuilderContext, domain | UX сценария КП |
| `src/domain/` | Бизнес-логика и типы | `calculateOption`, `pricing`, `normalizeRequest`, `buildProposalDocument`, `validateProposal`, `types` | money, dates, catalog resolve | Цены, статусы, документ |
| `src/services/` | Адаптеры I/O | `articleResolver`, `catalogService`, `draftCollectionRepository`, `pdfExporter`, `docxExporter` | domain types, data JSON | SKU, черновики, файлы |
| `src/data/` | Статические данные | `articlesCatalog.json` (~9.3 MB), mapping, contentBlocks, seeds, demos | импорт-скрипт | Расчёт/SKU/документ |
| `scripts/` | Offline импорт Excel | `importArticles.mts` | xlsx, reference/*.xlsx | Каталог артикулов |
| `reference/` | Excel + HTML-макет | `артикулы_….xlsx`, `1.html` | — | Импорт / визуальный референс |
| `e2e/`, `src/test/` | Автотесты | smoke, export-fixes, domain, quoteFlow… | vitest/playwright | Регрессии |
| `audit/` | Исторические артефакты аудита | AUDIT.md, FIX_REPORT, logs, exports | — | Не runtime |
| `public/fonts/` | Шрифты для PDF | Roboto TTF | pdfExporter | PDF кириллица |
| `docs/handoff/` | Передача контекста | этот отчёт + MASTER_CONTEXT | — | Документация |

---

## 3. Карта функциональности и бизнес-процессов

### 3.1 Пользовательские сценарии (подтверждённые)

| # | Сценарий | UI | Backend/domain | Статус |
|---|---|---|---|---|
| 1 | Создать КП / открыть демо | `HomePage` | `draftCollectionRepository.create` / demo proposal | Полный |
| 2 | Список, поиск, rename, duplicate, delete черновиков | `HomePage` | draftCollection v2 | Полный |
| 3 | Шаг 1 — реквизиты | `StepDetails` | `UPDATE_META`, `validateStep1` | Полный |
| 4 | Шаг 2 — парсинг запроса + конфигурация продуктов | `StepConfiguration` | `normalizeRequest`, `APPLY_CANDIDATE`, reducer config actions | Полный (с оговорками parser/needs_rule) |
| 5 | Шаг 3 — альтернативы, скидки, таблица расчёта | `StepCalculation` | `SET_ALTERNATIVES_MODE`, `UPDATE_OPTION_TERMS`, `calculateOptionSync` | Полный в demo-scope |
| 6 | Шаг 4 — предпросмотр PDF | `DocumentPreview` | `buildProposalDocument` + `exportService.toPdf` | Полный |
| 7 | Экспорт DOCX/PDF | `ExportPanel` | `proposalForExport` → exporters | Полный |
| 8 | Справочник артикулов | `ArticlesPage` | catalog JSON | Полный (browse); «в КП» — **частично** |
| 9 | Импорт Excel → каталог | CLI `npm run import:articles` | `scripts/importArticles.mts` | Полный при наличии файла |

### 3.2 Функциональность по статусам реализации

**Полностью реализовано (в рамках demo MVP):**
- 4-шаговый конструктор, autosave, multi-draft localStorage v2 + миграция v1.
- Demo-расчёт PAM UL/CS (12м/perp), AM base+modules (WL→LL), CM Windows, ITDR Mon+MFA.
- Документ с contentBlocks, демо-баннер, DOCX/PDF.
- Резолв SKU из каталога / seeds / observed без выдумывания 46/77.
- Unit (~48) + e2e (~6).

**Частично:**
- Сроки подписки ≠ 12 месяцев → `needs_rule`, цены null.
- PAM RL, все PAM-модули, CM multiplatform, доп. годы поддержки → `needs_rule`.
- Кнопка «Использовать в КП» на Articles → `/?useArticle=` **без обработчика** на `HomePage`.
- Меню «Мои КП / Все КП / Продукты / Шаблоны» — stubs (`AppShell`, класс `soon`).

**UI без backend-подтверждения:** нет — backend отсутствует целиком; всё локально.

**Backend/API без UI:** `createDemoCalculatorService` (`demoCalculator.ts`) — адаптер порта, UI не импортирует.

**В документации / старых аудитах, устарело относительно кода:**
- «PDF не работает» — **исправлено** (`pdfExporter.ts`, FIX_REPORT).
- «`certified=null` блокирует цену» — **изменено**: `certificationFactor` трактует null/false как ordinary (`calculateOption.ts` ~159–163); parser пишет `false` при отсутствии ФСТЭК (`normalizeRequest.ts` ~326).

---

## 4. Карта компонентов и взаимосвязей

### 4.1 Основные потоки данных

**A. Создание и редактирование КП**

```
HomePage.createDraft
  → draftCollectionRepository.create()
  → navigate(/proposals/:id/edit)
  → BuilderPage
  → BuilderProvider (hydrate get)
  → HYDRATE → builderReducer (recalcAll / calculateOptionSync)
  → Workspace steps
  → dirty → autosave 600ms → draftCollectionRepository.save(revision)
```

**B. Парсинг → конфигурация → расчёт**

```
StepConfiguration.runParse
  → normalizeRequest(raw)
  → APPLY_CANDIDATE
  → candidateToConfiguration (+ clone for alternatives)
  → recalcOption → calculateOptionSync
       → pricePamBase | priceAm | priceCm | priceItdr
       → resolveSkuSync / resolveArticle
  → CalculationResult на option
  → UI таблицы + buildProposalDocument
```

**C. Экспорт**

```
ExportPanel → exportDocx | exportPdf (BuilderProvider)
  → stateRef.current
  → proposalForExport → calculateOptionSync per option
  → buildProposalDocument
  → exportService.toDocx | toPdf
  → file-saver saveAs
```

**D. Артикулы (browse)**

```
ArticlesPage → articlesCatalog.json
  → filter/search/pagination
  → «Использовать в КП» → /?useArticle=SKU  ✗ HomePage не читает
```

### 4.2 Матрица зависимостей (критичные)

| Компонент | Получает | Возвращает/меняет | Зависит от | Используют |
|---|---|---|---|---|
| `calculateOptionSync` | `ProposalOption`, revision | `CalculationResult` | `pricing`, `money`, `catalogService` | reducer, BuilderProvider export, tests |
| `normalizeRequest` | string | `ParseCandidate` | aliases, regex | StepConfiguration |
| `buildProposalDocument` | `Proposal` | `ProposalDocument` | contentBlocks, demoSupplier | Provider, exporters, preview |
| `resolveArticle` | line context | found/ambiguous/not_found | catalog/seeds/observed | catalogService |
| `draftCollectionRepository` | envelopes | list/get/save | localStorage | HomePage, BuilderProvider |
| `builderReducer` | `BuilderAction` | `BuilderState` | calculateOptionSync | BuilderProvider |

### 4.3 Внешние системы

| Система | Статус |
|---|---|
| HTTP API / backend | Нет |
| БД | Нет |
| Auth / SSO | Нет |
| Live Excel прайс | Нет (только offline import) |
| CDN шрифтов | Локальный vfs pdfmake + `public/fonts` |

---

## 5. Аудит данных, API и интеграций

### 5.1 База данных

**Отсутствует.** Персистентность — browser localStorage:

| Ключ | Назначение | Файл |
|---|---|---|
| `indeed-proposal-builder:drafts:index:v2` | индекс черновиков | `draftCollectionRepository.ts` L8 |
| `indeed-proposal-builder:drafts:item:v2:{id}` | тело `DraftEnvelope` | L9 |
| `indeed-proposal-builder:drafts:migrated:v2` | флаг миграции | L10 |
| `indeed-proposal-builder:draft:v1` | legacy | `localDraftRepository.ts` L4 |
| `indeed-proposal-builder:sidebar-collapsed` | UI | L5 |

Optimistic concurrency: `save(envelope, expectedRevision)` → conflict → HYDRATE из stored.

Миграции схемы: только client-side v1→v2 (`migrateLegacyIfNeeded`). SQL/миграции сервера — N/A.

### 5.2 API

HTTP endpoints **нет**. Контракты — TypeScript interfaces в `types.ts` L284+. Режим `CalculationResult.mode: 'demo' | 'api'` зарезервирован; runtime всегда `'demo'` (`calculateOption.ts` ~859).

### 5.3 Статические «модели данных»

| Сущность | Источник | Объём |
|---|---|---|
| ArticleEntry | `articlesCatalog.json` | 10297, importStatus=ok |
| Control seeds | `articleControlSeeds.json` | 18 |
| Observed SKU | `observedSkus.json` | 39 |
| Calculator mapping | `calculatorMapping.json` | 31 itemIds, sourceId S08 |
| Content blocks | `contentBlocks.json` | 35 |
| Product defs | `products.ts` + mapping | AM/CM/PAM/ITDR |
| Proposal / Option / Configuration / QuoteLine | `types.ts` | schemaVersion 1 |

### 5.4 Импорт Excel

`scripts/importArticles.mts`: чтение ячеек по **адресам** (не compressed rows); листы AM/CM/PAM/ITDR/сертификаты/разовые. Без файла — `missing_source`, exit 2, без выдуманных данных. Отчёт: `articlesImportReport.json`.

Изменения каталога требуют перезапуска импорта и согласованности с `articleResolver` / observed / mapping — потенциально затрагивают SKU в существующих черновиках (локальных).

---

## 6. Подтверждённые технические проблемы

> Проблемы сентябрьского P1 (PDF / VAT sum / stale export), подтверждённо закрытые в FIX_REPORT и текущем коде, **не повторяются** как открытые дефекты.

### P-01 — Dead link «Использовать в КП»
- **Компонент:** Articles → Home
- **Файлы:** `src/pages/ArticlesPage.tsx` ~116; `HomePage.tsx` — нет `useArticle`
- **Факты:** navigate на `/?useArticle=…`; HomePage query не читает
- **Последствия:** пользователь ожидает вставку в КП, получает только главную
- **Критичность:** средняя (UX)
- **Причина:** незавершённый сценарий
- **Исправление:** читать query → create/open draft → APPLY_CANDIDATE / ADD_PRODUCT; либо убрать кнопку
- **Затронет:** HomePage, возможно BuilderProvider/reducer
- **Проверка:** e2e Articles → кнопка → конфигурация содержит SKU/продукт

### P-02 — Demo-калькулятор не подключён через порт
- **Компонент:** services
- **Файлы:** `demoCalculator.ts`; вызовы `calculateOptionSync` в `builderReducer.ts`, `BuilderProvider.tsx`
- **Факты:** адаптер существует, UI его не использует
- **Последствия:** усложняет будущую смену на `mode:'api'`
- **Критичность:** низкая (техдолг)
- **Исправление:** инжект `CalculatorService` в Provider/reducer
- **Проверка:** unit с mock calculator

### P-03 — Навигационные stubs «скоро»
- **Файлы:** `src/components/layout/AppShell.tsx` (~L17, 82–85)
- **Факты:** disabled пункты меню
- **Критичность:** низкая (ожидаемо для MVP)
- **Не дефект scope**, но UX-ожидание

### P-04 — Известные пробелы правил (`needs_rule`) — продуктовые ограничения
- **Файлы:** `calculateOption.ts` (коды `pam_rl_needs_rule`, `pam_module_needs_rule`, `term_needs_rule`, `am_term_needs_rule`, `cm_multi_needs_rule`, `itdr_term_needs_rule`, `support_extra_needs_rule`)
- **Факты:** цены null + status needs_rule; README подтверждает
- **Последствия:** нельзя корректно посчитать ряд реальных запросов
- **Критичность:** высокая **для продакшен-выдачи**; средняя для demo-MVP (осознанно)
- **Исправление:** только после утверждённых тарифных правил / live калькулятора
- **Проверка:** фикстуры + oracle сумм

### P-05 — PAM UL 46/77: цена есть, SKU нет
- **Файлы:** `articleResolver.ts` ~204–210; README
- **Факты:** явный `not_found`, без invented SKU
- **Критичность:** средняя для выдачи КП; корректное поведение для demo
- **Исправление:** бизнес-решение по SKU-матрице

### P-06 — Blocking issues не блокируют экспорт
- **Файлы:** `DocumentPreview.tsx` `ExportPanel`; `collectBlockingIssues`
- **Факты:** export доступен при blockingIssues (демо-политика)
- **Последствия:** можно скачать КП с needs_rule / ошибками минимумов
- **Критичность:** средняя при смене режима на «клиентский выпуск»
- **Исправление:** gate по флагу `releaseMode` / статусу proposal

### P-07 — Каталог ~9.3 MB в бандле
- **Файлы:** `src/data/articlesCatalog.json`
- **Факты:** 10297 записей, импортируется в frontend bundle path
- **Последствия:** размер загрузки, холодный старт
- **Критичность:** низкая–средняя (perf)
- **Исправление:** lazy fetch / indexed search / split chunks
- **Проверка:** Lighthouse / bundle analyzer

### P-08 — Устаревание исторических AUDIT.md относительно кода
- **Файлы:** `audit/2026-09-19T1746Z/AUDIT.md` vs текущий `calculateOption` / `pdfExporter`
- **Факты:** утверждения про сломанный PDF и certified=null противоречат коду
- **Последствия:** риск неверной передачи контекста
- **Критичность:** средняя для handoff
- **Исправление:** помечать AUDIT как historical; опираться на этот отчёт + MASTER_CONTEXT

### Гипотезы (не подтверждены как дефекты в этом прогоне)
- Визуальная приёмка PDF в Acrobat GUI в cloud-среде.
- Поведение при QuotaExceededError localStorage на больших черновиках.
- Полный паритет pixel-perfect с `reference/1.html` (осознанно не цель).

---

## 7. Возможности улучшения

| ID | Что улучшить | Какую проблему решает | Факты | Файлы | Reuse? | Добавить | Риски | Приоритет / сложность |
|---|---|---|---|---|---|---|---|---|
| I-01 | Довести «Использовать в КП» | P-01 | dead query | ArticlesPage, HomePage, reducer | да, APPLY_CANDIDATE | query handler | неверный продукт из SKU | P1 / низкая |
| I-02 | Wiring CalculatorService | P-02 | неиспользуемый адаптер | BuilderProvider, demoCalculator | да | DI context | регрессии recalc | P2 / средняя |
| I-03 | Правила PAM modules / RL / CM multi | P-04 | needs_rule codes | calculateOption, pricing, tests | таблицы S08 частично | утверждённые тарифы | неверные суммы | P1 / высокая |
| I-04 | Live / API calculator | demo-only | mode flag | services, contracts | порты | backend | безопасность цен | P3 / высокая |
| I-05 | Gate экспорта для release | P-06 | ExportPanel | DocumentPreview, validate | collectBlockingIssues | policy flag | false block demo | P2 / низкая |
| I-06 | Lazy catalog | P-07 | 9.3MB JSON | catalogService, ArticlesPage | resolver | chunked load | flash empty | P2 / средняя |
| I-07 | Серверные черновики | local-only | README | draft repos | DraftEnvelope | API+auth | privacy | P3 / высокая |
| I-08 | Расширить e2e alternatives/WL | недавние фиксы | unit есть | e2e/ | да | browser asserts | flaky | P2 / низкая |
| I-09 | Срок ≠12м | needs_rule | pricing tables annual only | calculateOption, pricing | формулы | коэффициенты сроков | ошибки денег | P1 / высокая |

Экономический эффект **не оценивался** (нет измерений).

---

## 8. Приоритизированная дорожная карта

### P0 — критические
*На текущем tip подтверждённых P0 (безопасность/целостность/доступность рантайма) **нет**.*  
Demo-режим не хранит секретов сервера; XSS через React text binding (исторический аудит).

### P1 — значимые
| Задача | Цель | Результат | Модули | Зависимости | Сложность | Риски | DoD |
|---|---|---|---|---|---|---|---|
| P1-A | Сценарий useArticle | SKU из справочника попадает в КП | pages, reducer | — | низкая | неверный mapping SKU→config | e2e green |
| P1-B | Документировать/закрыть gaps правил | явный список поддерживаемых конфигов для заказчика | domain, README | бизнес-тарифы | высокая | неверные цены | oracle+unit |
| P1-C | Политика «demo vs release» | нельзя выдать КП с needs_rule как финальный | ExportPanel, validate, types | продукт | средняя | ломает демо-flow | флаг + тесты |

### P2 — улучшения
| Задача | Цель | Модули | Сложность |
|---|---|---|---|
| P2-A | DI CalculatorService | app, services | средняя |
| P2-B | Lazy/search index каталога | data, services, ArticlesPage | средняя |
| P2-C | E2E alternatives + WL + export parity | e2e | низкая |
| P2-D | Пометить historical audit | audit/ | низкая |

### P3 — развитие
| Задача | Цель | Сложность |
|---|---|---|
| P3-A | Backend API + auth + shared drafts | высокая |
| P3-B | Live Excel / корпоративный прайс bridge | высокая |
| P3-C | Реализация меню «Мои КП / Шаблоны» | средняя |
| P3-D | SKU матрица PAM 46/77 | средняя (после бизнеса) |

---

## 9. Риски дальнейшей разработки

1. **Денежные регрессии** при правках `pricing.ts` / `calculateOption.ts` без oracle-фикстур.
2. **Расхождение UI summary vs document** при дублировании логики итогов.
3. **SKU false-positive** при ослаблении фильтров `articleResolver`.
4. **localStorage quota / multi-tab** revision conflicts.
5. **Путаница historical AUDIT** vs текущий код.
6. **Импорт Excel** — смена структуры книги ломает address-based importer.
7. **pdfmake 0.3 API** хрупкий к смене major (уже ломался).

Чувствительные модули: `calculateOption.ts`, `pricing.ts`, `articleResolver.ts`, `buildProposalDocument.ts`, `builderReducer.ts` (SET_ALTERNATIVES_MODE), `draftCollectionRepository.ts`, `pdfExporter.ts`.

---

## 10. Регламент безопасного внесения изменений

### Для GPT-6 / любого агента

1. **Аудит задачи** — прочитать MASTER_CONTEXT + этот отчёт; найти реальные файлы.
2. **Анализ существующей реализации** — с line refs; не предполагать backend.
3. **План изменений** — список файлов, контракты, тесты.
4. **Проверка рисков** — деньги, SKU, draft schema, export parity.
5. **Согласование** — **запрещено начинать правки кода до явного разрешения пользователя**.
6. **Реализация** — минимальный diff; conventional commits (`feat`/`fix`/`chore`…).
7. **Тестирование** — `npm run typecheck && npm run test`; e2e при UI/export.
8. **Регрессии** — фикстуры PAM25/46/77, WL=LL, alternatives mode, draft migrate.
9. **Итоговый отчёт** — что изменено, как проверено, остаточные риски.

### Обязательные проверки после изменений

| Область изменения | Минимум тестов |
|---|---|
| pricing / calculateOption | `domain.test.ts`, `quoteFlow.test.ts` |
| normalizeRequest | domain parser cases |
| articleResolver / catalog | `articleResolver.test.ts` |
| drafts | `draftCollection.test.ts` |
| alternatives | `alternativesMode.test.ts` |
| export/PDF | `export.test.ts`, `e2e/export-fixes.spec.ts` |
| UI flow | `e2e/smoke.spec.ts` |

### Контракты, которые нельзя ломать без миграции

- `Proposal.schemaVersion` / `DraftEnvelope.storageVersion`
- Ключи localStorage v2
- Формат `CalculationResult` / `QuoteLine.skuStatus`
- Семантика `needs_rule` и запрет invented SKU для 46/77
- WL всегда priced as LL
- `mode: 'demo'` и демо-баннер в документе, пока нет release mode

---

## 11. MASTER_CONTEXT_FOR_GPT6

Полная база знаний вынесена в отдельный файл:

→ **[`MASTER_CONTEXT_FOR_GPT6.md`](./MASTER_CONTEXT_FOR_GPT6.md)**

---

## 12. Непроверенные области и ограничения аудита

| Область | Статус | Комментарий |
|---|---|---|
| Полный прогон `npm test` / e2e в этом сеансе | не проверен повторно | опираемся на структуру тестов и FIX_REPORT; рекомендуется прогон перед разработкой |
| Визуальная приёмка PDF в GUI | не проверено | e2e download + код pdfExporter подтверждены |
| Все 10k SKU вручную | не проверено | выборочно seeds/tests + import report |
| Содержимое секретов | N/A | секретов приложения нет |
| Production deploy / CI на forge | не проверено | нет GitLab CI в корне проекта |
| Совместимость Safari/Firefox | не проверено | Playwright default chromium |
| Нагрузочное тестирование | не проверено | |
| Юридическая корректность реквизитов demoSupplier | не проверялась | demo-only |

**Ограничение:** отсутствие исходного продуктового промпта/ТЗ в репозитории; scope выведен из README, кода, reference HTML и audit/.

---

## Таблица покрытия аудита

| Область | Статус проверки | Основные файлы | Вывод |
|---|---|---|---|
| Назначение / README | проверено | `README.md` | Frontend MVP КП, demo calc |
| Git / ветка | проверено | git status/log | `cursor/…-f84c` @ `895213b` |
| Стек / package.json | проверено | `package.json` | Vite/React19/TS, без backend deps |
| Маршруты / entry | проверено | `main.tsx`, `App.tsx`, pages | `/`, `/articles`, `/proposals/:id/edit` |
| State / drafts | проверено | `BuilderProvider`, `builderReducer`, draft repos | localStorage v2 + migrate |
| Расчёт / pricing | проверено | `calculateOption.ts`, `pricing.ts` | S08 demo, needs_rule gaps |
| Parser | проверено | `normalizeRequest.ts` | PAM/AM/CM/ITDR + cert |
| Документ / export | проверено | `buildProposalDocument`, pdf/docx exporters | PDF init исправлен; export из stateRef |
| SKU / catalog | проверено | `articleResolver`, catalog JSON, import script | 10297 ok; 46/77 unresolved |
| UI steps | проверено | features/* | 4 шага + preview |
| Articles → КП | проверено | ArticlesPage, HomePage | dead `useArticle` |
| Auth / API / DB | проверено | — | отсутствуют |
| Тесты | частично проверено | `src/test/*`, `e2e/*` | ~48 unit + 6 e2e по коду; прогон не повторялся |
| Historical audit drift | проверено | `audit/*/AUDIT.md`, FIX_REPORT | старые P1 закрыты |
| CI/CD deploy | не проверено | — | нет pipeline в проекте |
| A11y полный | не проверено | — | вне scope этого аудита |
| Perf каталога | частично проверено | размер JSON | риск bundle size |

---

## Приложение A — Быстрые команды

```bash
cd indeed-proposal-builder
npm install
npm run dev          # http://127.0.0.1:43123
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run import:articles   # требует Excel в reference/ или uploads/
```

## Приложение B — Ключевые needs_rule коды

`pam_rl_needs_rule`, `term_needs_rule`, `pam_module_needs_rule`, `am_term_needs_rule`, `cm_multi_needs_rule`, `itdr_term_needs_rule`, `support_extra_needs_rule`.

## Приложение C — Контрольные привязки импорта

- `PAM!C293` → `PAM-01120025`
- `АМ !C7` → `AM-00000001`
- `Сертификаты на внедрение!A4` → `СВ-AM-00001`
