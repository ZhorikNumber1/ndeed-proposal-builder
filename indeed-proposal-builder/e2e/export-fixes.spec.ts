import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

test.describe('export freshness and PDF', () => {
  test('qty change is reflected in DOCX; PDF downloads as real PDF', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.goto('/');
    await expect(page.locator('.title')).toHaveText('Конструктор КП');

    const demo = page.getByRole('button', { name: 'Демо-пример' });
    if (await demo.isVisible().catch(() => false)) {
      await demo.click();
    }

    await page.getByRole('button', { name: /Изменить/ }).click();
    await page.getByLabel('Наименование заказчика').fill('ООО Тест аудита Fix');
    await page.getByLabel('Номер КП').fill('КП-FIX-001');
    await page.getByLabel('Дата КП').fill('2026-06-15');
    await page.getByRole('button', { name: /^Далее/ }).click();

    const input = page.getByLabel('Свободный ввод запроса');
    await input.fill('PAM 46 FSTEC');
    await input.press('Enter');
    const apply = page.getByRole('button', { name: /Применить распознанные/ });
    if (await apply.isVisible()) await apply.click();

    const qty = page.getByLabel('Количество').first();
    await qty.fill('77');
    await qty.blur();
    await expect(page.locator('.summary-row .sum').first()).toContainText(/10/);

    // VAT must be per-alternative (550), not summed 1100 across alternatives
    const vatText = await page.locator('.summary-panel').innerText();
    expect(vatText).toMatch(/550/);
    expect(vatText).not.toMatch(/1\s*100/);

    const docxWait = page.waitForEvent('download');
    await page.getByRole('button', { name: /Скачать КП в Word/i }).click();
    const docxDownload = await docxWait;
    const docxPath = join(test.info().outputDir, await docxDownload.suggestedFilename());
    await docxDownload.saveAs(docxPath);
    const docxBuf = readFileSync(docxPath);
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    const xml = execSync(`unzip -p "${docxPath}" word/document.xml`, { encoding: 'utf8' });
    const plain = xml.replace(/<[^>]+>/g, ' ');
    expect(plain).toContain('КП-FIX-001');
    expect(plain).toMatch(/15\.06\.2026/);
    expect(plain).toMatch(/77/);
    expect(plain).toContain('ООО Тест аудита Fix');

    const pdfWait = page.waitForEvent('download', { timeout: 45_000 });
    await page.getByRole('button', { name: /Скачать КП в PDF/i }).click();
    const pdfDownload = await pdfWait;
    const pdfPath = join(test.info().outputDir, await pdfDownload.suggestedFilename());
    await pdfDownload.saveAs(pdfPath);
    expect(readFileSync(pdfPath).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(readFileSync(pdfPath).byteLength).toBeGreaterThan(1000);
  });

  test('collapsed sidebar is ~76px; 390px has no page scroll', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.setViewportSize({ width: 1792, height: 1024 });
    await page.goto('/');
    const demo = page.getByRole('button', { name: 'Демо-пример' });
    if (await demo.isVisible().catch(() => false)) await demo.click();

    await page.getByRole('button', { name: /Свернуть меню/ }).click();
    const collapsedW = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
    expect(collapsedW).toBeGreaterThanOrEqual(70);
    expect(collapsedW).toBeLessThanOrEqual(90);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(scroll).toBe(false);
  });
});
