# Конструктор коммерческих предложений «Индид» (MVP)

Фронтенд-MVP конструктора КП на **Vite + React + TypeScript**. Визуальный референс — `reference/1.html`.

## Запуск

```bash
cd indeed-proposal-builder
npm install
npm run dev
```

Приложение: [http://127.0.0.1:43123](http://127.0.0.1:43123)

Стартовая страница — **Главная** (`/`). Конструктор открывается по адресу `/proposals/:id/edit`.

### Команды

| Команда | Описание |
|---|---|
| `npm run dev` | Dev-сервер (порт 43123) |
| `npm run build` | Production-сборка |
| `npm run preview` | Превью сборки (порт 43124) |
| `npm run typecheck` | Проверка TypeScript |
| `npm run lint` | Oxlint |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run import:articles` | Импорт справочника из Excel → `src/data/articlesCatalog.json` |

## Основной сценарий

1. Откройте Главную → **Создать КП** (или **Открыть пример**).
2. Заполните реквизиты → продукты → расчёты → предпросмотр.
3. Черновик автосохраняется в этом браузере; на Главной виден список независимых КП.
4. Вкладка **Артикулы** — справочник после импорта Excel.
5. Предпросмотр показывает **тот же PDF**, что скачивается кнопкой экспорта.

## Импорт артикулов

Положите файл `артикулы_09.04.2026 копия.xlsx` в `reference/` или `uploads/` и выполните:

```bash
npm run import:articles
```

Скрипт пишет:

- `src/data/articlesCatalog.json` — нормализованные записи;
- `src/data/articlesImportReport.json` — сводка, конфликты, неоднозначности.

Без Excel полный импорт **не выполняется** (не подменяется выдуманными данными). Для подбора PAM UL25 используются контрольные seeds (`articleControlSeeds.json`) до появления полного каталога.

## Хранение черновиков

- Коллекция: `indeed-proposal-builder:drafts:index:v2` + `…:item:v2:{id}`
- Legacy одиночный ключ `indeed-proposal-builder:draft:v1` мигрирует один раз без потери данных
- Данные локальны для браузера/origin; серверной синхронизации нет

## Ограничения локального MVP

- Расчёт `mode=demo`, не live Excel/корпоративный прайс
- Полный справочник артикулов требует приложенного Excel
- PAM 46/77 считаются, но SKU не выдумываются
- Нет авторизации, общего реестра сотрудников и backend

## Структура

`src/app` · `src/pages` · `src/domain` · `src/features` · `src/services` · `src/data` · `scripts/importArticles.mts`
