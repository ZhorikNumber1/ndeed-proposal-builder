import { describe, expect, it } from 'vitest';
import { calculateOptionSync } from '../domain/calculateOption';
import { CALCULATOR_PROVENANCE } from '../domain/pricing';
import { buildProposalDocument } from '../domain/buildProposalDocument';
import { resolveArticle } from '../services/articleResolver';
import type { Configuration, ProposalOption } from '../domain/types';
import { DEMO_SUPPLIER } from '../data/demoSupplier';

function pamOption(
  metric: 'users' | 'concurrent_sessions',
  quantity: number,
  licenseType: 'subscription' | 'perpetual',
  certified: boolean | null = false,
): ProposalOption {
  const cfg: Configuration = {
    id: 'cfg1',
    product: 'PAM',
    platform: null,
    metric,
    quantity,
    certified,
    kitQuantity: 0,
    modules: [],
    enabled: true,
  };
  return {
    id: 'opt1',
    label: licenseType === 'subscription' ? 'Годовая' : 'Бессрочная',
    licenseType,
    termMonths: licenseType === 'subscription' ? 12 : null,
    commercialTerms: {
      signedDiscount: 0,
      supportSignedDiscount: 0,
      adjustmentReason: null,
      supportIncludedMonths: 12,
      supportExtraYears: 0,
      exceptions: [],
    },
    configurations: [cfg],
    calculation: null,
  };
}

describe('Excel control cases (price-calculator NEW SHA-256 59a5fdda…)', () => {
  it('tracks ACTIVE calculator provenance hash', () => {
    expect(CALCULATOR_PROVENANCE.sourceHash).toBe(
      '59a5fdda805f2b558b2c8bfb24a446de0c36c72cee30008f239fb0e70d2e3ce3',
    );
    expect(CALCULATOR_PROVENANCE.sourceSheets).toContain('RUB ALL ПОДПИСКА');
  });

  it('PAM CS 10 subscription list total = 3,488,380 (RUB ALL ПОДПИСКА E35 path)', () => {
    const calc = calculateOptionSync(pamOption('concurrent_sessions', 10, 'subscription'), 1);
    expect(calc.status).toBe('complete');
    expect(calc.totals.amount).toBe('3488380.00');
    expect(calc.items[0]?.saleQuantity).toBe(1);
    expect(calc.items[0]?.packageCapacity).toBe(10);
  });

  it('PAM CS 10 perpetual list total = 6,544,800', () => {
    const calc = calculateOptionSync(pamOption('concurrent_sessions', 10, 'perpetual'), 1);
    expect(calc.totals.amount).toBe('6544800.00');
  });

  it('PAM UL 60 subscription list total = 6,665,940', () => {
    const calc = calculateOptionSync(pamOption('users', 60, 'subscription'), 1);
    expect(calc.totals.amount).toBe('6665940.00');
  });
});

describe('SKU registry vs historical KP anchors', () => {
  it('resolves PAM UL 60 → PAM-01120060 from official catalog', () => {
    const r = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 60,
      certification: false,
      customerGroupId: 'standard',
    });
    expect(r.status).toBe('found');
    expect(r.sku).toBe('PAM-01120060');
    expect(r.skuStatus).toBe('catalog_confirmed');
  });

  it('does not accept historical PAM-02120010 — absent from PAM sheet series', () => {
    const r = resolveArticle({
      itemId: 'PAM.CS',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 10,
      certification: false,
      customerGroupId: 'standard',
    });
    expect(r.status).toBe('not_found');
    expect(r.sku).toBeNull();
    expect(r.issues.some((i) => /02120010|not present|No article/i.test(i))).toBe(true);
  });

  it('does not accept special PAM-02000010 as standard CS perpetual', () => {
    const r = resolveArticle({
      itemId: 'PAM.CS',
      licenseType: 'perpetual',
      termMonths: null,
      packageCapacity: 10,
      certification: false,
      customerGroupId: 'standard',
    });
    expect(r.status).toBe('not_found');
    expect(r.sku).toBeNull();
    expect(r.issues.some((i) => /special|excluded|not present|No article/i.test(i))).toBe(true);
  });

  it('resolves PAM CS 25 subscription to PAM-02120025', () => {
    const r = resolveArticle({
      itemId: 'PAM.CS',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 25,
      certification: false,
      customerGroupId: 'standard',
    });
    expect(r.status).toBe('found');
    expect(r.sku).toBe('PAM-02120025');
  });
});

describe('AM WL=LL, markup, UL46/77, ITDR content', () => {
  it('prices AM Windows Logon the same as Linux Logon (WL=LL)', () => {
    const mk = (itemId: 'AM.WINDOWS_LOGON' | 'AM.LINUX_LOGON'): ProposalOption => ({
      id: 'am1',
      label: 'Годовая',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: {
        signedDiscount: 0,
        supportSignedDiscount: 0,
        adjustmentReason: null,
        supportIncludedMonths: 12,
        supportExtraYears: 0,
        exceptions: [],
      },
      configurations: [
        {
          id: 'c1',
          product: 'AM',
          platform: null,
          metric: 'users',
          quantity: 100,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm1', itemId, metric: 'users', quantity: 100 }],
          enabled: true,
        },
      ],
      calculation: null,
    });
    const wl = calculateOptionSync(mk('AM.WINDOWS_LOGON'), 1);
    const ll = calculateOptionSync(mk('AM.LINUX_LOGON'), 1);
    const wlMod = wl.items.find((i) => i.itemId.includes('LOGON'));
    const llMod = ll.items.find((i) => i.itemId.includes('LOGON'));
    expect(wlMod?.lineTotal).toBe(llMod?.lineTotal);
    expect(wlMod?.lineTotal).not.toBe('0.00');
    expect(wl.status).not.toBe('error');
  });

  it('treats negative signedDiscount as markup (price increase)', () => {
    const base = pamOption('users', 60, 'subscription');
    const marked = pamOption('users', 60, 'subscription');
    marked.commercialTerms.signedDiscount = -0.2;
    const a = calculateOptionSync(base, 1);
    const b = calculateOptionSync(marked, 1);
    expect(Number(b.totals.amount)).toBeGreaterThan(Number(a.totals.amount));
  });

  it('does not invent SKU for PAM UL 46 / 77', () => {
    for (const cap of [46, 77]) {
      const r = resolveArticle({
        itemId: 'PAM.UL',
        licenseType: 'subscription',
        termMonths: 12,
        packageCapacity: cap,
        certification: false,
        customerGroupId: 'standard',
      });
      expect(r.status).toBe('not_found');
      expect(r.sku).toBeNull();
    }
  });

  it('ITDR Monitoring-only proposal omits MFA content blocks', () => {
    const option: ProposalOption = {
      id: 'itdr1',
      label: 'Годовая',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: {
        signedDiscount: 0,
        supportSignedDiscount: 0,
        adjustmentReason: null,
        supportIncludedMonths: 12,
        supportExtraYears: 0,
        exceptions: [],
      },
      configurations: [
        {
          id: 'c1',
          product: 'ITDR',
          platform: null,
          metric: 'licensed_units',
          quantity: 100,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm1', itemId: 'ITDR.MONITORING', metric: 'licensed_units', quantity: 100 }],
          enabled: true,
        },
      ],
      calculation: null,
    };
    option.calculation = calculateOptionSync(option, 1);
    const doc = buildProposalDocument({
      schemaVersion: 1,
      id: 'p-itdr',
      number: 'TEST-ITDR',
      issueDate: '2026-09-18',
      rawRequest: 'ITDR Monitoring 100',
      customer: { legalName: 'Test Customer' },
      manager: { displayName: 'Manager' },
      supplierProfileId: DEMO_SUPPLIER.id,
      currency: 'RUB',
      validity: { kind: 'calendar_months', months: 1 },
      options: [option],
      status: 'draft',
      issues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const text = doc.blocks
      .filter((b) => b.type === 'paragraph' || b.type === 'heading')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n');
    expect(/MFA/i.test(text)).toBe(false);
    expect(/Monitoring|мониторинг/i.test(text)).toBe(true);
  });
});

describe('supplier / document layout anchors', () => {
  it('uses Алексей Баранов and exact managing-org title from KP DOCX', () => {
    expect(DEMO_SUPPLIER.signatoryName).toBe('Алексей Баранов');
    expect(DEMO_SUPPLIER.signatoryRole).toContain('Управляющий управляющей организации АО «Индид»');
    expect(DEMO_SUPPLIER.signatoryRole).toContain('Индивидуальный предприниматель');
    expect(DEMO_SUPPLIER.signatoryRole.includes('—')).toBe(false);
  });

  it('puts Итого in column 4 of pricing table', () => {
    const option = pamOption('users', 60, 'subscription');
    option.calculation = calculateOptionSync(option, 1);
    const doc = buildProposalDocument({
      schemaVersion: 1,
      id: 'p1',
      number: 'TEST-60',
      issueDate: '2026-09-18',
      rawRequest: 'PAM 60',
      customer: { legalName: 'Test Customer' },
      manager: { displayName: 'Manager' },
      supplierProfileId: DEMO_SUPPLIER.id,
      currency: 'RUB',
      validity: { kind: 'calendar_months', months: 1 },
      options: [option],
      status: 'draft',
      issues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const table = doc.blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table').toBe(true);
    if (table && table.type === 'table') {
      const total = table.rows.find((r) => r.isTotal);
      expect(total?.cells[3]).toBe('Итого');
      expect(total?.cells[5]?.replace(/\s/g, '')).toMatch(/6.?665.?940/);
    }
    const meta = doc.blocks.find((b) => b.type === 'meta');
    expect(meta && meta.type === 'meta' && meta.left.startsWith('Исх. №')).toBe(true);
  });
});
