/**
 * Audit-only Playwright scenarios. Does not modify product code.
 * Uses isolated storageState to avoid clobbering user drafts.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/workspace/indeed-proposal-builder/audit/2026-09-19T1746Z';
const shots = join(OUT, 'screenshots');
const exportsDir = join(OUT, 'exports');
const logs = join(OUT, 'logs');
mkdirSync(shots, { recursive: true });
mkdirSync(exportsDir, { recursive: true });
mkdirSync(logs, { recursive: true });

const consoleLog: string[] = [];
const networkFails: string[] = [];

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
}

test.describe.configure({ mode: 'serial' });

test('audit browser scenarios', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1792, height: 1024 },
    // isolated storage — no shared draft
    storageState: undefined,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLog.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => consoleLog.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => networkFails.push(`${req.failure()?.errorText} ${req.url()}`));

  await page.goto('/');
  await expect(page.locator('.title')).toHaveText('Конструктор КП');
  await expect(page.locator('.brand')).toContainText('Индид');

  // Dismiss draft prompt if any (shouldn't on fresh context)
  if (await page.getByRole('dialog', { name: /черновик/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Демо-пример|Восстановить/ }).first().click();
  }

  // --- Visual 1792 ---
  await shot(page, '01-step2-demo-1792x1024');

  // Measure key layout
  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const topbar = document.querySelector('.topbar') as HTMLElement | null;
    const right = document.querySelector('.right-col') as HTMLElement | null;
    const app = document.querySelector('.app-shell') as HTMLElement | null;
    const preview = document.querySelector('.preview-card') as HTMLElement | null;
    const summary = document.querySelector('.summary-panel') as HTMLElement | null;
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const sums = Array.from(document.querySelectorAll('.summary-row .sum')).map((el) => el.textContent?.trim());
    const bodyScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    return {
      sidebarW: sidebar?.getBoundingClientRect().width,
      topbarH: topbar?.getBoundingClientRect().height,
      rightW: right?.getBoundingClientRect().width,
      previewW: preview?.getBoundingClientRect().width,
      summaryW: summary?.getBoundingClientRect().width,
      red,
      bg,
      sums,
      bodyScroll,
      appClass: app?.className,
    };
  });
  writeFileSync(join(logs, 'layout-1792.json'), JSON.stringify(metrics, null, 2));

  // Sidebar collapse
  const collapse = page.getByRole('button', { name: /Свернуть меню|Развернуть меню/ });
  await collapse.click();
  await expect(collapse).toHaveAttribute('aria-expanded', 'false');
  const collapsedW = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
  await shot(page, '02-sidebar-collapsed-1792');
  await collapse.click();

  // Totals should NOT be HTML demo numbers
  const sumText = (metrics.sums ?? []).join(' | ');
  const hasWrongHtmlPrices = /1\s*514\s*690|2\s*839\s*130/.test(sumText);
  writeFileSync(
    join(logs, 'ui-assertions.json'),
    JSON.stringify(
      {
        collapsedW,
        hasWrongHtmlPrices,
        sumText,
        expectedDemoSubApprox: '3 782 150',
        consoleLog,
      },
      null,
      2,
    ),
  );

  // Step 1 edit
  await page.getByRole('button', { name: /Изменить/ }).click();
  await page.getByLabel('Наименование заказчика').fill('ООО Тест аудита');
  await page.getByLabel('Номер КП').fill('КП-AUDIT-UI-001');
  await page.getByLabel('Дата КП').fill('2026-06-15');
  await page.getByLabel('Менеджер (метаданные)').fill('Петров П.П.');
  await page.getByLabel('Тип срока действия').selectOption('calendar_months');
  await page.getByLabel('Значение срока').fill('1');
  await page.getByRole('button', { name: 'Далее →' }).click();
  await expect(page.locator('.doc-meta')).toContainText('ООО Тест аудита');
  await expect(page.locator('.doc-meta')).toContainText('КП-AUDIT-UI-001');
  await expect(page.locator('.doc-meta')).toContainText('15.06.2026');
  await shot(page, '03-after-meta-edit');

  // Validity text in preview
  const validityText = await page.locator('.paper').innerText();
  const monthNotDays = /в течение месяца|1 мес|календар/i.test(validityText) && !/в течение 30 дней/.test(validityText);
  // parse may say "месяца" from calendar_months_text

  // Parse PAM 46 FSTEC
  const input = page.getByLabel('Свободный ввод запроса');
  await input.fill('PAM 46 FSTEC');
  await input.press('Enter');
  const apply = page.getByRole('button', { name: /Применить распознанные/ });
  await expect(apply).toBeVisible();
  await apply.click();
  await shot(page, '04-after-pam46-apply');

  // Change qty to 77
  const qty = page.getByLabel('Количество').first();
  await qty.fill('77');
  await qty.blur();
  await page.waitForTimeout(200);
  await shot(page, '05-qty-77');

  // Switch metric to CS
  await page.getByLabel(/Метрика|metric/i).or(page.locator('select.value-control').nth(0)).first().isVisible();
  // Find select for metric by option text
  const metricSelect = page.locator('.updated-param-table select').filter({ hasText: 'UL' }).or(
    page.locator('select.value-control', { has: page.locator('option[value="users"]') }),
  ).first();
  if (await metricSelect.count()) {
    await metricSelect.selectOption('concurrent_sessions');
  }

  // Toggle kit
  const kitInput = page.locator('.updated-param-table input[type="number"]').nth(1);
  if (await kitInput.count()) {
    await kitInput.fill('0');
    await kitInput.fill('1');
  }

  // Duplicate config
  const dup = page.getByRole('button', { name: 'Дублировать' }).first();
  if (await dup.count()) await dup.click();

  // Save draft
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByRole('status')).toContainText(/Черновик сохранён/);

  // Reload restore
  await page.reload();
  if (await page.getByRole('dialog').filter({ hasText: /черновик/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Восстановить' }).click();
  }
  await expect(page.locator('.meta-value').filter({ hasText: 'ООО Тест аудита' }).first()).toBeVisible({
    timeout: 5000,
  });
  await shot(page, '06-after-restore');

  // Step 3 on restored draft
  await page.getByRole('button', { name: /Параметры и расчёты/ }).click();
  const both = page.getByRole('button', { name: 'Обе альтернативы' });
  if (await both.isVisible().catch(() => false)) await both.click();
  await shot(page, '07-step3');

  // Step 4 / fullscreen
  await page.getByRole('button', { name: /Предпросмотр и экспорт/ }).click();
  await page.getByRole('button', { name: /На весь экран/ }).click();
  await expect(page.locator('.preview-overlay')).toBeVisible();
  await shot(page, '08-fullscreen-preview');
  await page.keyboard.press('Escape');
  await expect(page.locator('.preview-overlay')).toHaveCount(0);

  // Export DOCX
  const [docxDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Скачать КП в Word/ }).click(),
  ]);
  const docxPath = join(exportsDir, 'browser-' + (await docxDownload.suggestedFilename()));
  await docxDownload.saveAs(docxPath);

  // Export PDF
  let pdfOk = false;
  let pdfError = '';
  let pdfPath = '';
  try {
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /Скачать КП в PDF/ }).click(),
    ]);
    pdfPath = join(exportsDir, 'browser-' + (await pdfDownload.suggestedFilename()));
    await pdfDownload.saveAs(pdfPath);
    pdfOk = true;
  } catch (e) {
    pdfError = e instanceof Error ? e.message : String(e);
    const toast = await page.getByRole('status').textContent().catch(() => null);
    pdfError += ` toast=${toast}`;
    await shot(page, '08b-pdf-failed');
  }

  // XSS check before clearing
  await page.getByRole('button', { name: /Изменить/ }).click();
  await page.getByLabel('Наименование заказчика').fill('<img src=x onerror=alert(1)>XSS');
  await page.getByRole('button', { name: 'Далее →' }).click();
  const xssText = await page.locator('.meta-value').filter({ hasText: 'XSS' }).first().textContent();
  const xssExecuted = await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss === true);

  // New proposal clears
  await page.getByRole('button', { name: 'Новое КП' }).click();
  await page.getByRole('button', { name: /Данные КП/ }).click();
  const customerVal = await page.getByLabel('Наименование заказчика').inputValue();
  const numberVal = await page.getByLabel('Номер КП').inputValue();

  // Responsive shots on empty/new — still useful for shell
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /Продукты и конфигурация/ }).click();
  await shot(page, '09-1440x900');
  const scroll1440 = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, '10-1280x800');

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, '11-390x844');
  const mobileMenu = await page.locator('.mobile-menu-btn').isVisible();

  await page.setViewportSize({ width: 1792, height: 1024 });
  const soonDisabled = await page.locator('.nav-item.soon').count();

  writeFileSync(
    join(logs, 'browser-audit.json'),
    JSON.stringify(
      {
        metrics,
        collapsedW,
        hasWrongHtmlPrices,
        sumText,
        monthNotDays,
        validitySnippet: validityText.slice(0, 500),
        docxPath,
        pdfOk,
        pdfError,
        pdfPath,
        newProposalCustomer: customerVal,
        newProposalNumber: numberVal,
        scroll1440,
        mobileMenu,
        soonDisabled,
        xssExecuted,
        xssText,
        consoleLog,
        networkFails,
      },
      null,
      2,
    ),
  );
});
