# Отчёт об исправлениях по аудиту «Конструктор КП»

**Дата:** 2026-09-19  
**Базовый аудит:** `audit/2026-09-19T1746Z/AUDIT.md`  
**Ветка:** `cursor/indeed-proposal-builder-f84c`  
**Проект:** `/workspace/indeed-proposal-builder`  
**Приложение:** http://127.0.0.1:43123  

## Краткий вывод

Исправлены все пункты из блока «до демонстрации» и ближайшие P2 из аудита: **PDF**, **НДС по альтернативам**, **stale export**, **ширина свёрнутого sidebar**, **горизонтальный скролл на 390px**, **parser leftover**, **дубли issues**.  

Проверки: `typecheck` / `lint` / `26` unit / `3` e2e — **все EXIT:0**. Скачанный PDF — реальный `%PDF-1.3` (2 страницы). DOCX после смены qty=77 содержит актуальные метаданные и «77 пользователей».

| Оценка | После исправлений |
|---|---|
| Демонстрация фронтенда | **Да** (включая PDF) |
| Подключение backend | Без изменений (интерфейсы demo/api на месте) |
| Реальная выдача КП клиенту | **Нет** (по-прежнему mode=demo, непроверенные SKU) |

## Что исправлено

### P1-01 — PDF-экспорт
- **Было:** `pdfMake.createPdf is not a function` / `Cannot redefine property: vfs` (неверная инициализация pdfmake 0.3).
- **Стало:** загрузка `default` экспорта, запись шрифтов через `virtualfs.writeFileSync`, `await createPdf(...).getBlob()`.
- **Файлы:** `src/services/pdfExporter.ts`
- **Проверка:** e2e `export-fixes.spec.ts` + `exports/DEMO_КП-FIX-001.pdf` (`file` → PDF document, 2 pages)

### P1-02 — НДС комплекта суммировался по альтернативам
- **Было:** одна строка «НДС … 1 100,00 ₽» (550+550).
- **Стало:** отдельная строка «НДС · таблица N» на каждую альтернативу (по 550 ₽).
- **Файлы:** `src/features/configuration/StepConfiguration.tsx`
- **Проверка:** e2e assert `550` и отсутствие `1 100` в summary

### P1-03 — Stale export
- **Было:** `dispatch(RECALCULATE_ALL)` затем `buildProposalDocument(state.proposal)` из замыкания.
- **Стало:** синхронный `proposalForExport` из `stateRef` + `calculateOptionSync`, затем экспорт; UI синхронизируется через `RECALCULATE_ALL`.
- **Файлы:** `src/app/BuilderProvider.tsx`
- **Проверка:** e2e — после qty=77 DOCX содержит `КП-FIX-001`, `15.06.2026`, `77`, заказчика Fix

### P2-01 — Свёрнутый sidebar
- **Было:** ~196–215 px из‑за `min-width: auto` у grid-item и видимого текста.
- **Стало:** `min-width: 0`, явная ширина `var(--sidebar-collapsed)`, скрытие подписей через `position: absolute`.
- **Файлы:** `src/styles/layout.css`
- **Проверка:** e2e — ширина sidebar в диапазоне 70–90 px

### P2-02 — Горизонтальный скролл на 390×844
- **Было:** page-level horizontal scroll.
- **Стало:** mobile media — одноколоночный status-card, гибкие bottom buttons, auto-width таблицы параметров, `overflow-x: hidden` на узких экранах.
- **Файлы:** `src/styles/layout.css`
- **Проверка:** e2e — `scrollWidth <= clientWidth + 1`

### P2-03 / P2-04 — Parser leftover
- **Было:** `PAM25` оставался в unknown; обломки `ей` после `пользователей` (`\w` не матчит кириллицу).
- **Стало:** удаление compact-токена из текста; кириллические окончания `[а-яёa-z]*`; безопасное удаление предлогов.
- **Файлы:** `src/domain/normalizeRequest.ts`
- **Проверка:** unit-тесты `parses compact PAM25…`, `does not leave Cyrillic stem fragments…`

### P2-05 — Дубли issues
- **Было:** `[...issues, ...results[0].issues]` при общей ссылке на массив → удвоение.
- **Стало:** однократное присвоение + `dedupeIssues` на выходе калькулятора.
- **Файлы:** `src/domain/calculateOption.ts`
- **Проверка:** unit `does not duplicate calculation issues`

## Что намеренно не менялось

- Backend / live Excel / auth / БД — вне scope MVP.
- Генерация SKU для PAM46/77 — неустановленное бизнес-правило.
- Pixel-perfect к `1.html`.
- Режим «выпуск клиенту» vs demo.

## Результаты команд

| Команда | Результат |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK (4 прежних warning only-export-components) |
| `npm run test` | 26 passed |
| `npm run build` | OK |
| `npm run test:e2e` | 3 passed (smoke + export-fixes ×2) |

Лог: `audit/2026-09-19T1808Z/logs/commands.log`  
Артефакты: `audit/2026-09-19T1808Z/exports/`

## Критерии приёмки (закрыты)

1. Кнопка PDF скачивает файл `%PDF` без toast об ошибке.  
2. В summary НДС не суммируется между альтернативами.  
3. Изменение qty/метаданных сразу отражается в DOCX.  
4. Collapsed sidebar ≈76 px на 1792.  
5. Нет page horizontal scroll на 390×844.  

## Остаточный риск

PDF визуально в Word/Acrobat GUI в этой среде не открывался вручную (структура и e2e download подтверждены). Для реальной выдачи КП по-прежнему нужны утверждённые SKU/правила и backend.
