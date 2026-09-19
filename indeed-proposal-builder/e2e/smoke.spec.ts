import { test, expect } from '@playwright/test';

test('smoke: home, create draft, edit, parse, save', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.locator('.brand')).toContainText('Индид');

  await page.getByRole('button', { name: 'Создать КП' }).click();
  await expect(page).toHaveURL(/\/proposals\/.+\/edit/);
  await expect(page.locator('.title')).toHaveText('Конструктор КП');

  const collapse = page.getByRole('button', { name: /Свернуть меню|Развернуть меню/ });
  await collapse.click();
  await expect(collapse).toHaveAttribute('aria-expanded', 'false');
  await collapse.click();

  await page.getByLabel('Наименование заказчика').fill('ООО «Тест»');
  await page.getByLabel('Номер КП').fill('КП-TEST-1');
  await page.getByLabel('Менеджер').fill('Тестов Т.Т.');
  await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByLabel('Свободный ввод запроса')).toBeVisible();

  const input = page.getByLabel('Свободный ввод запроса');
  await input.fill('PAM 46 FSTEC');
  await input.press('Enter');
  const apply = page.getByRole('button', { name: /Применить распознанные/ });
  if (await apply.isVisible()) await apply.click();

  const qty = page.getByLabel('Количество').first();
  await qty.fill('77');
  await qty.blur();

  await page.getByRole('button', { name: /Сохранить черновик/ }).click();
  await expect(page.getByRole('status')).toContainText(/Черновик сохранён|Сохран/);

  await page.getByRole('link', { name: 'Главная' }).or(page.getByRole('button', { name: 'На главную' })).first().click();
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.getByText('ООО «Тест»')).toBeVisible();
});

test('articles page shows imported catalog', async ({ page }) => {
  await page.goto('/articles');
  await expect(page.getByRole('heading', { name: 'Артикулы' })).toBeVisible();
  await expect(page.getByText(/Статус:\s*ok/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Импортировано \d+ записей/)).toBeVisible();
  const search = page.getByLabel('Поиск артикулов');
  await search.fill('PAM-01120025');
  await expect(page.getByText('PAM-01120025', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
});

test('search PAM 25 fills price table and SKU', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Создать КП' }).click();
  await expect(page).toHaveURL(/\/proposals\/.+\/edit/);
  await page.getByLabel('Наименование заказчика').fill('ООО Тест');
  await page.getByLabel('Номер КП').fill('КП-FLOW-1');
  await page.getByLabel('Менеджер').fill('Тестов');
  await page.getByRole('button', { name: /^Далее/ }).click();

  const input = page.getByLabel('Свободный ввод запроса');
  await input.fill('PAM 25');
  await input.press('Enter');

  await expect(page.getByText('Определённые продукты').first()).toBeVisible();
  await expect(page.getByText('PAM-01120025', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.quote-lines-table')).toContainText('2');
  await expect(page.locator('.quote-lines-table')).toContainText('907');
  await expect(page.locator('.quote-lines-table')).toContainText('пакет 25');
  await expect(page.locator('.summary-panel .sum').first()).toContainText('907');
});

test('open example reaches builder without crash', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть пример' }).click();
  await expect(page).toHaveURL(/\/proposals\/.+\/edit/);
  await expect(page.locator('.title')).toHaveText('Конструктор КП');
  await expect(page.getByText('ООО «Ромашка»')).toBeVisible();
  await expect(page.locator('.panel-title', { hasText: 'Продукты и конфигурация' })).toBeVisible();
});
