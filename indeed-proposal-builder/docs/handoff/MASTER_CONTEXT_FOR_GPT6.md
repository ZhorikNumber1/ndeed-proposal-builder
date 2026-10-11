# MASTER_CONTEXT_FOR_GPT6

Самодостаточная техническая база знаний о проекте **Конструктор коммерческих предложений «Индид»**.  
Предназначена для нового чата/агента без истории предыдущих сессий.

**Путь проекта:** `/workspace/indeed-proposal-builder`  
**Ветка:** `cursor/indeed-proposal-builder-f84c`  
**Коммит контекста аудита:** `895213b` (`fix: restore alternatives mode switching and price WL as LL`)  
**Полный аудит:** [`AUDIT_REPORT.md`](./AUDIT_REPORT.md)  
**Правило №1:** не изменять код, пока пользователь явно не разрешит реализацию.

---

### A. Project Overview

**Что это:** локальный SPA (Vite + React + TypeScript) для сборки черновиков коммерческих предложений по продуктам Indeed: **PAM**, **AM**, **CM**, **ITDR**.

**Зачем:** ускорить менеджеру заполнение реквизитов, конфигурацию продуктов (в т.ч. из свободного текста), получить **демо-расчёт** по извлечённым правилам прайса S08, сопоставить артикулы из справочника и скачать DOCX/PDF с предпросмотром.

**Чем не является:**
- не корпоративный backend и не live-мост к Excel-калькулятору;
- не система с auth, общим реестром КП и БД;
- не готовый инструмент финальной выдачи КП клиенту без оговорок (всегда `mode: 'demo'`, демо-баннер в документе).

**Визуальный референс UI:** `reference/1.html`.

---

### B. Technology Stack

| Слой | Технологии |
|---|---|
| UI | React 19.2, react-router-dom 7, кастомный CSS (`src/styles/*`), **без** shadcn/Tailwind |
| Tooling | Vite 8, TypeScript 5.9, oxlint, Vitest 5, Playwright |
| Документы | pdfmake 0.3 + vfs fonts, pdfjs-dist (preview), docx, file-saver |
| Данные | статические JSON/TS; импорт Excel через SheetJS (`xlsx`) в `scripts/` |
| Хранение | browser `localStorage` (коллекция черновиков v2) |
| Backend | **нет** |

**Скрипты** (`package.json`):
- `dev` → `127.0.0.1:43123`
- `preview` → `43124`
- `build` / `typecheck` / `lint` / `test` / `test:e2e`
- `import:articles` → `tsx scripts/importArticles.mts`

---

### C. Repository Map

```
indeed-proposal-builder/
├── src/
│   ├── main.tsx                 # createRoot + BrowserRouter
│   ├── app/                     # App routes, BuilderProvider, reducer, Workspace
│   ├── pages/                   # HomePage, ArticlesPage, BuilderPage
│   ├── features/                # StepDetails, StepConfiguration, StepCalculation, DocumentPreview
│   ├── domain/                  # types, calculate, pricing, normalize, document, validate
│   ├── services/                # catalog, drafts, pdf/docx, demoCalculator, contracts
│   ├── data/                    # articlesCatalog (~10k), mapping, contentBlocks, demos
│   ├── components/layout/       # AppShell
│   ├── styles/                  # tokens, layout, pages
│   └── test/                    # Vitest suites
├── scripts/importArticles.mts
├── reference/                   # Excel артикулов + 1.html
├── e2e/                         # Playwright
├── audit/                       # historical audit artifacts (могут устаревать)
├── docs/handoff/                # этот handoff
├── public/fonts/                # Roboto для PDF
└── package.json
```

Корень git-репозитория workspace также содержит пустой `main` (`f2322fa` Initialize project). Рабочий код — в подпапке `indeed-proposal-builder/`.

---

### D. Architecture

#### D.1 Слои

1. **Presentation:** pages + features + AppShell  
2. **Application state:** `BuilderProvider` + `builderReducer` (только маршрут `/proposals/:id/edit`)  
3. **Domain:** чистые функции расчёта, нормализации, документа, валидации  
4. **Infrastructure services:** localStorage drafts, catalog/SKU resolve, file export  
5. **Static data:** JSON каталоги и текстовые блоки документа  

#### D.2 Маршруты (`src/app/App.tsx`)

| Path | Page | Provider |
|---|---|---|
| `/` | `HomePage` | нет |
| `/articles` | `ArticlesPage` | нет |
| `/proposals/:id/edit` | `BuilderPage` → `BuilderProvider` → `Workspace` | да |
| `*` | redirect `/` | — |

#### D.3 State

`BuilderState` (`builderReducer.ts`): `{ proposal, ui, isDemoExample, revision }`.

Ключевые actions: `HYDRATE`, `UPDATE_META`, `SET_RAW_REQUEST`, `APPLY_CANDIDATE`, CRUD конфигураций/модулей, `SET_ALTERNATIVES_MODE`, `UPDATE_OPTION_TERMS`, `RECALCULATE_ALL`, UI flags, export pending.

Почти каждое изменение конфигурации вызывает `recalcOption` / `recalcAll` → **`calculateOptionSync`**.

Autosave: dirty → debounce 600 ms → `draftCollectionRepository.save` с revision check (`BuilderProvider.tsx`).

#### D.4 Главный поток

```
Создать черновик (Home)
  → открыть Builder
  → Step1 UPDATE_META
  → Step2 normalizeRequest → APPLY_CANDIDATE → calculateOptionSync
  → Step3 terms / alternatives → calculateOptionSync
  → Step4 buildProposalDocument → PDF preview
  → Export: proposalForExport(stateRef) → buildProposalDocument → toDocx/toPdf
```

#### D.5 Порты

В `src/domain/types.ts`: `CalculatorService`, `CatalogService`, `DraftRepository`, `ExportService`.  
Реэкспорт: `src/services/contracts.ts`.  
**Важно:** UI считает через прямой `calculateOptionSync`, а не через `createDemoCalculatorService()` (`demoCalculator.ts` — адаптер-заготовка).

---

### E. Functional Capabilities

#### E.1 Реализовано

- Независимые черновики: create / list / search / rename / duplicate / delete / open demo.
- Миграция legacy ключа `draft:v1` → коллекция v2.
- 4 шага конструктора + сворачиваемый sidebar + toast + issues panel.
- Парсер свободного текста (`normalizeRequest`): продукты, qty, ФСТЭК, модули AM (включая WL→LL alias), сроки 6/12/24/36.
- Demo-расчёт PAM/AM/CM/ITDR с лестничными тарифами S08.
- Режимы альтернатив: subscription / perpetual / both (`SET_ALTERNATIVES_MODE`).
- Резолв SKU из полного каталога (если import ok) иначе control seeds + observed.
- Документ: supplier header, meta, product intros, pricing tables, licensing blocks, warranty, signature, unresolved notes, demo banner.
- Экспорт DOCX и PDF; preview = тот же PDF pipeline.
- CLI импорт артикулов из Excel по cell addresses.

#### E.2 Ограничения текущей реализации

- Всегда `calculation.mode = 'demo'`; provenance `demo-extracted-S08`.
- Non-12m subscription, PAM RL, PAM modules, CM multiplatform, extra support years → `needs_rule`, цены null.
- PAM UL capacity 46 и 77: **цена считается**, **SKU не выдумывается** (`articleResolver`).
- «Использовать в КП» на `/articles` ведёт на `/?useArticle=` — **HomePage не обрабатывает**.
- Пункты меню «Мои КП / Все КП / Продукты / Шаблоны» — stubs.
- `collectBlockingIssues` **не** блокирует кнопки экспорта (демо-политика).
- Нет серверной синхронизации; очистка данных сайта удаляет черновики.

#### E.3 Статусы функционала

| Функция | Статус |
|---|---|
| Конструктор 4 шага | полный (demo) |
| PDF/DOCX | полный (после FIX_REPORT) |
| Каталог артикулов browse | полный |
| Articles → insert into KP | частичный / broken UX |
| Live Excel prices | отсутствует |
| Auth / multi-user | отсутствует |
| Release-grade КП | отсутствует |

---

### F. Business Rules

Центр правил: **`src/domain/calculateOption.ts`** + **`src/domain/pricing.ts`**.  
Парсинг входа: **`src/domain/normalizeRequest.ts`**.  
Валидация реквизитов: **`src/domain/validateProposal.ts`**.

#### F.1 Деньги и формулы (`pricing.ts`, `money.ts`)

- Кумулятивная лестница `cumulativeCost` / `averageUnitCost`.
- Subscription (annual): `roundUp(U * 0.533 * c * mult)` через `unitPriceFromU`.
- Perpetual: `Math.ceil(U) * c * mult`.
- ITDR: `roundUp(U * c)` (без 0.533).
- Скидка/наценка: `unit * (1 - signedDiscount)`.
- `roundUp` Excel-like: `ceil(value - 1e-10)`.
- Деньги — decimal strings, округление через `toMoney` (копейки).

#### F.2 Certification

- `certificationFactor(certified)`: `true` → c=1.3; **null/false → c=1** (ordinary). Null больше не блокирует PAM-цену.
- Parser при отсутствии ФСТЭК выставляет `certified: false` (не сохраняет null) — `normalizeRequest` ~326.
- UI select yes/no; kitQuantity при включении cert.

#### F.3 PAM (`pricePamBase`)

- Метрики UL / CS / RL; RL → `pam_rl_needs_rule`, null prices.
- Min: UL≥5, CS≥5; perpetual UL≥10.
- Цена при perpetual **или** termMonths===12; иначе `term_needs_rule`.
- Продажа пакетом: `packageCapacity=qty`, `saleQuantity=1`, `saleUnit='package'`.
- ФСТЭК kit `PAM.FSTEC_KIT`: gross 3050, VAT 550 @22%; kit при `certified===false` → issue `kit_without_cert`.
- **Любой** PAM module → `pam_module_needs_rule` (не тарифицируется в demo).

#### F.4 AM (`priceAm`)

- Min 100 users.
- `certified===true` → warn `am_cert_demo` + ×1.3.
- Perpetual band 5–7M → `am_perpetual_band`.
- **WL всегда тарифицируется как LL** (`AM.WINDOWS_LOGON` → `AM.LINUX_LOGON`); display может сохранять исходный id.
- ESSO multiplier ×2; biometrics использует `AM_BASE_TIERS`, прочие модули — `AM_MODULE_TIERS`.

#### F.5 CM (`priceCm`)

- `multiplatform` → early `cm_multi_needs_rule`.
- Platform обязателен; min 100 users.
- Тарифы только Windows base/modules.

#### F.6 ITDR (`priceItdr`)

- Пустые modules → default MONITORING.
- MFA без Monitoring → error.
- Certified → `itdr_cert_unconfirmed` warn.
- Non-12m → `itdr_term_needs_rule`.

#### F.7 Статус расчёта

```
needs_rule если есть issue.code includes 'needs_rule'
partial если mix known/unknown или blocking errors при иначе complete
```

(`calculateOption.ts` ~844–850)

#### F.8 Документ

`buildProposalDocument`: всегда `isDemo: true`, fileBaseName `DEMO_{number}`; блоки из `contentBlocks.json` + supplier `demoSupplier.ts`.

#### F.9 Правила, затрагивающие много модулей

Изменение **WL=LL**, **S08 множителя 0.533**, **семантики certified**, **SET_ALTERNATIVES_MODE clone**, **SKU resolve filters** влияет на reducer UI, document, tests, e2e одновременно.

---

### G. API & Data Model

#### G.1 HTTP API

Отсутствует.

#### G.2 Ключевые типы (`src/domain/types.ts`)

- `ProductCode`: AM | CM | PAM | ITDR  
- `Configuration`: product, platform, metric, quantity, certified, kitQuantity, modules, enabled  
- `ProposalOption`: licenseType, termMonths, commercialTerms, configurations, calculation  
- `Proposal`: schemaVersion 1, meta, options, status, issues  
- `QuoteLine`: sku/skuStatus, prices, tax, saleUnit  
- `CalculationResult`: mode demo|api, status complete|partial|needs_rule|error  
- `DraftEnvelope` (`draftTypes.ts`): storageVersion 2, revision, proposal, builder UI slice  

#### G.3 Каталог

| Файл | Содержание |
|---|---|
| `articlesCatalog.json` | importStatus ok, **10297** entries |
| `articlesImportReport.json` | сводка импорта 2026-09-19 |
| `articleControlSeeds.json` | 18 seeds (fallback) |
| `observedSkus.json` | 39 observed fixtures |
| `calculatorMapping.json` | 31 itemIds, sourceId S08 |
| `contentBlocks.json` | 35 document blocks |

#### G.4 localStorage keys

- `indeed-proposal-builder:drafts:index:v2`
- `indeed-proposal-builder:drafts:item:v2:{id}`
- `indeed-proposal-builder:drafts:migrated:v2`
- `indeed-proposal-builder:draft:v1` (legacy)
- `indeed-proposal-builder:sidebar-collapsed`

#### G.5 SKU resolution order (`articleResolver` + `catalogService`)

1. Special cases: FSTEC_KIT / PAM UL 46|77 → not_found  
2. Pool: full catalog if import ok else seeds  
3. Filter by itemId/product/term/capacity/metric/cert/customer group  
4. Score pickBest; ambiguous if distinct SKUs  
5. Fallback observed  
6. Else unresolved (mapping label only in catalogService)

---

### H. Critical Components

| Компонент | Почему критичен | Путь |
|---|---|---|
| `calculateOptionSync` | все цены и статусы | `src/domain/calculateOption.ts` |
| `pricing.ts` | тарифные таблицы S08 | `src/domain/pricing.ts` |
| `normalizeRequest` | вход из естественного языка | `src/domain/normalizeRequest.ts` |
| `builderReducer` + `SET_ALTERNATIVES_MODE` | целостность опций | `src/app/builderReducer.ts` |
| `BuilderProvider` / `proposalForExport` | autosave + корректный export | `src/app/BuilderProvider.tsx` |
| `buildProposalDocument` | содержимое КП | `src/domain/buildProposalDocument.ts` |
| `articleResolver` | запрет invented SKU | `src/services/articleResolver.ts` |
| `draftCollectionRepository` | сохранность черновиков | `src/services/draftCollectionRepository.ts` |
| `pdfExporter` | PDF (хрупкий pdfmake 0.3) | `src/services/pdfExporter.ts` |
| `importArticles.mts` | источник каталога | `scripts/importArticles.mts` |

---

### I. Existing Problems

Подтверждённые на tip `895213b` (детали в AUDIT_REPORT §6):

| ID | Проблема | Критичность |
|---|---|---|
| P-01 | `useArticle` query не обрабатывается HomePage | средняя UX |
| P-02 | `demoCalculator` не используется UI | низкая (техдолг) |
| P-03 | Nav stubs «скоро» | низкая / scope |
| P-04 | Пробелы тарифов → needs_rule | высокая для prod; ок для demo |
| P-05 | PAM 46/77 без SKU | средняя для выдачи |
| P-06 | Blocking issues не стопят export | средняя для release mode |
| P-07 | Каталог ~9.3MB в frontend data | perf |
| P-08 | Historical `AUDIT.md` расходится с кодом | handoff риск |

**Закрыто ранее (не открывать снова без регрессии):** PDF createPdf, VAT sum across alternatives, stale export closure, sidebar width, mobile scroll, parser leftovers, duplicated issues — см. `audit/2026-09-19T1808Z/FIX_REPORT.md`.

---

### J. Improvement Opportunities

1. Замкнуть Articles → КП (P-01).  
2. Расширить тарифные правила после бизнес-утверждения (PAM modules/RL, CM multi, сроки ≠12).  
3. DI через `CalculatorService` для будущего API.  
4. Флаг `demo | release` с блокировкой экспорта.  
5. Lazy/index каталога.  
6. Backend drafts + auth (только если заказчик потребует).  
7. Усилить e2e на alternatives/WL/export.  
8. Пометить `audit/2026-09-19T1746Z` как historical.

Не предлагать переписывание архитектуры «ради моды» (Next.js/БД), пока задача — frontend demo MVP.

---

### K. Development Constraints

1. **Не начинать реализацию без явного разрешения пользователя.**  
2. Не выдумывать SKU (особенно PAM 46/77).  
3. Сохранять семантику WL = LL pricing.  
4. Сохранять `mode:'demo'` и демо-баннер, пока нет отдельного release mode.  
5. Не ломать ключи/схему DraftEnvelope без миграции.  
6. Export строить из актуального snapshot (`stateRef` + sync recalc), не из stale closure.  
7. Импорт Excel — address-based; не подменять missing source выдуманными данными.  
8. Conventional commits; ссылки на GitLab issues `#N` если появятся.  
9. Секреты не коммитить (сейчас серверных секретов нет).  
10. При конфликте README vs код — **приоритет у кода**.

---

### L. Testing & Deployment

#### L.1 Команды

```bash
cd indeed-proposal-builder
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run import:articles
```

#### L.2 Тестовое покрытие (по файлам)

| Файл | Фокус | ~число |
|---|---|---|
| `domain.test.ts` | parser, PAM fixtures, kit VAT, WL=LL, ITDR/CM, doc | 25 |
| `articleResolver.test.ts` | SKU resolve / 46/77 | 11 |
| `quoteFlow.test.ts` | search→price→document | 5 |
| `draftCollection.test.ts` | migrate, conflict, isolation | 5 |
| `alternativesMode.test.ts` | mode switch | 1 |
| `export.test.ts` | DOCX OOXML | 1 |
| `e2e/smoke.spec.ts` | UI happy path | 4 |
| `e2e/export-fixes.spec.ts` | PDF/DOCX qty, sidebar | 2 |

#### L.3 Deploy

Отдельного CI/CD и серверного деплоя в репозитории **не обнаружено**. Доставка = static Vite build (`npm run build` → `dist/`). Runtime — статический хостинг + браузер пользователя.

---

### M. Recommended Roadmap

| Pri | Задача | Сложность |
|---|---|---|
| P0 | — (открытых P0 нет) | — |
| P1 | Довести useArticle → КП | низкая |
| P1 | Зафиксировать/расширить матрицу поддерживаемых конфигов с бизнесом | высокая |
| P1 | Политика demo vs release export | средняя |
| P2 | CalculatorService DI | средняя |
| P2 | Lazy catalog | средняя |
| P2 | E2E alternatives/WL | низкая |
| P2 | Historical audit disclaimer | низкая |
| P3 | Backend + auth + live prices | высокая |
| P3 | SKU для 46/77 по решению бизнеса | средняя |
| P3 | Реальные пункты меню | средняя |

---

### N. Unknowns & Open Questions

1. Утверждённые тарифы для PAM modules / RL / CM multi / сроков ≠12 / доп. поддержки — **нет в коде**.  
2. Официальная SKU-матрица для PAM UL 46/77.  
3. Нужен ли заказчику release mode без демо-баннера.  
4. Требования к multi-user / серверным черновикам.  
5. Полный визуальный паритет с `reference/1.html` — целевой или ориентир.  
6. CI на GitLab/forge — не настроен в этом дереве.  
7. Повторный прогон полного test/e2e suite в сеансе аудита 2026-10-11 — **не выполнялся**; перед разработкой прогнать.  
8. Исходный продуктовый промпт/ТЗ в репозитории отсутствует.

---

### O. Working Instructions for GPT-6

```
Аудит задачи
  → прочитать этот MASTER_CONTEXT + AUDIT_REPORT
  → найти реализацию по путям/функциям ниже
  → НЕ предполагать backend/БД/auth

Анализ существующей реализации
  → читать calculateOption / pricing / reducer / resolver с line evidence
  → проверить, не закрыт ли уже дефект в FIX_REPORT

План изменений
  → список файлов, контракты, тесты, риски (деньги/SKU/drafts/export)

Проверка совместимости
  → schemaVersion, localStorage keys, needs_rule semantics, WL=LL

СОГЛАСОВАНИЕ С ПОЛЬЗОВАТЕЛЕМ
  → ждать явного «реализуй / исправь / сделай»
  → до разрешения — только анализ и план

Реализация (после разрешения)
  → минимальный diff; не рефакторить соседнее
  → conventional commit messages

Тестирование
  → npm run typecheck && npm run test
  → e2e при UI/export
  → ручная проверка контрольных сумм PAM25 / альтернатив при ценовых правках

Регрессии
  → alternatives mode, WL as LL, quote pipeline, PDF download, draft migrate

Итоговый отчёт
  → что сделано, доказательства, остаточные риски, что не проверено
```

**Запреты:**
- не invent SKU;
- не удалять демо-баннер «молча»;
- не коммитить/push/migrate без запроса пользователя в режимах, где это запрещено задачей;
- не опираться на устаревшие утверждения `audit/2026-09-19T1746Z/AUDIT.md` без сверки с кодом;
- не раскрывать секреты (если появятся `.env` — описывать только назначение).

**Точки входа для чтения кода (порядок знакомства):**
1. `README.md`  
2. `src/app/App.tsx`, `BuilderProvider.tsx`, `builderReducer.ts`  
3. `src/domain/types.ts`, `calculateOption.ts`, `pricing.ts`, `normalizeRequest.ts`  
4. `src/domain/buildProposalDocument.ts`  
5. `src/services/articleResolver.ts`, `draftCollectionRepository.ts`, `pdfExporter.ts`  
6. `src/pages/*`, `src/features/*`  
7. `src/test/domain.test.ts`, `quoteFlow.test.ts`, `alternativesMode.test.ts`  
8. `scripts/importArticles.mts`

---

*Конец MASTER_CONTEXT_FOR_GPT6. При существенных изменениях архитектуры или бизнес-правил этот файл должен быть обновлён в том же PR/коммите, что и код.*
