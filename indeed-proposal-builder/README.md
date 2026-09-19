# Конструктор коммерческих предложений «Индид» (MVP)

Фронтенд-MVP конструктора КП на **Vite + React + TypeScript**. Визуальный референс — `reference/1.html` (исходный макет из вложения `1_4223.html`).

## Запуск

```bash
cd indeed-proposal-builder
npm install
npm run dev
```

Приложение: [http://127.0.0.1:43123](http://127.0.0.1:43123)

### Команды

| Команда | Описание |
|---|---|
| `npm run dev` | Dev-сервер (порт 43123) |
| `npm run build` | Production-сборка |
| `npm run preview` | Превью сборки (порт 43124) |
| `npm run typecheck` | Проверка TypeScript |
| `npm run lint` | Oxlint |
| `npm run test` | Vitest (парсер, расчёт, черновик, документ) |
| `npm run test:e2e` | Playwright (если установлен браузер) |

## Что реализовано

- Оболочка и 4 шага создания КП по макету HTML (sidebar, stepper, метаданные, конфигурация, итоги, структура, предпросмотр, экспорт).
- Свободный ввод с детерминированным parser (`normalizeRequest`) и явным «Применить».
- Произвольные количества лицензий; PAM UL/CS пакеты (`saleQuantity=1`).
- Две независимые альтернативы (подписка / бессрочная) без суммирования итогов.
- Локальный демо-калькулятор (`mode=demo`) по извлечённым правилам S08.
- Единая модель документа → React preview, DOCX (`docx`), PDF (`pdfmake` + Roboto с кириллицей).
- Черновик в `localStorage` (`indeed-proposal-builder:draft:v1`).
- Сервисные интерфейсы для будущей замены backend/Excel.

## Ограничения локального демо

- Расчёт **не** подключён к Excel и **не** является корпоративным прайсом.
- Provenance: `price-calculator NEW.xlsx`, sha256 `d1fcd56c…09435`, `mode=demo`.
- Не реализованы или частично: PAM RL, CM Мультиплатформа, доп. годы поддержки, годовая WL, ряд PAM-модулей (AAPM/SQL Proxy) — честный `needs_rule` / «Требуется уточнение».
- SKU только из наблюдаемого справочника; коды для 46/77 пользователей **не** генерируются.
- Профиль поставщика и сертификат №4667 — демонстрационные исторические данные.
- Экспорт помечен как **демонстрационный черновик**.

## Точки подключения backend

Замените реализации в `src/services/` без переписывания UI:

- `CalculatorService` ← `demoCalculator.ts`
- `CatalogService` / `resolveSku` ← `catalogService.ts`
- `DraftRepository` ← `localDraftRepository.ts`
- `ExportService` ← `docxExporter.ts` / `pdfExporter.ts`

Данные каталога и текстов: `src/data/*`.

## Структура

См. `src/app`, `src/domain`, `src/features`, `src/services`, `src/data`, `reference/1.html`.
