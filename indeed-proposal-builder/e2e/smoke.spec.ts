import { test, expect } from '@playwright/test';

test('smoke: shell, edit customer, parse PAM, export', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Конструктор КП' }).or(page.locator('.title'))).toBeVisible();

  const collapse = page.getByRole('button', { name: /Свернуть меню|Развернуть меню/ });
  await collapse.click();
  await expect(collapse).toHaveAttribute('aria-expanded', 'false');
  await collapse.click();

  await page.getByRole('button', { name: /Изменить/ }).click();
  await page.getByLabel('Наименование заказчика').fill('ООО «Тест»');
  await page.getByRole('button', { name: /Далее/ }).first().click();

  const input = page.getByLabel('Свободный ввод запроса');
  await input.fill('PAM 46 FSTEC');
  await input.press('Enter');
  await page.getByRole('button', { name: /Применить распознанные/ }).click();

  const qty = page.getByLabel('Количество').first();
  await qty.fill('77');
  await qty.blur();

  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByRole('status')).toContainText(/Черновик сохранён|сохран/);

  await page.getByRole('button', { name: /Скачать КП в Word/ }).click();
  const [docx] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Скачать КП в Word/ }).click(),
  ]).catch(async () => {
    const d = await page.waitForEvent('download');
    return [d];
  });
  expect(docx.suggestedFilename()).toMatch(/\.docx$/i);
});
