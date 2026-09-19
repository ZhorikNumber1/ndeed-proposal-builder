import { test, expect } from '@playwright/test';

test('smoke: shell, edit, parse, save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.title')).toHaveText('Конструктор КП');
  await expect(page.locator('.brand')).toContainText('Индид');

  const collapse = page.getByRole('button', { name: /Свернуть меню|Развернуть меню/ });
  await collapse.click();
  await expect(collapse).toHaveAttribute('aria-expanded', 'false');
  await collapse.click();

  await page.getByRole('button', { name: /Изменить/ }).click();
  await page.getByLabel('Наименование заказчика').fill('ООО «Тест»');
  await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.locator('.doc-meta')).toContainText('ООО «Тест»');

  const input = page.getByLabel('Свободный ввод запроса');
  await input.fill('PAM 46 FSTEC');
  await input.press('Enter');
  const apply = page.getByRole('button', { name: /Применить распознанные/ });
  if (await apply.isVisible()) await apply.click();

  const qty = page.getByLabel('Количество').first();
  await qty.fill('77');
  await qty.blur();

  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByRole('status')).toContainText(/Черновик сохранён/);
});
