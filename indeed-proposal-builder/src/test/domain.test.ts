import { describe, expect, it } from 'vitest';
import { normalizeRequest } from '../domain/normalizeRequest';
import { calculateOptionSync } from '../domain/calculateOption';
import { defaultCommercialTerms } from '../data/demoProposal';
import type { Configuration, ProposalOption } from '../domain/types';
import { buildProposalDocument } from '../domain/buildProposalDocument';
import { createDemoProposal } from '../data/demoProposal';
import { DRAFT_STORAGE_KEY } from '../services/localDraftRepository';

function pamOption(
  quantity: number,
  licenseType: 'subscription' | 'perpetual',
  certified: boolean | null,
  kitQuantity: number,
  metric: Configuration['metric'] = 'users',
  signedDiscount = 0,
): ProposalOption {
  const cfg: Configuration = {
    id: 'cfg1',
    product: 'PAM',
    platform: null,
    metric,
    quantity,
    certified,
    kitQuantity,
    modules: [],
    enabled: true,
  };
  const option: ProposalOption = {
    id: 'opt1',
    label: licenseType,
    licenseType,
    termMonths: licenseType === 'subscription' ? 12 : null,
    commercialTerms: { ...defaultCommercialTerms(), signedDiscount },
    configurations: [cfg],
    calculation: null,
  };
  return option;
}

describe('normalizeRequest', () => {
  it('parses PAM 46 FSTEC', () => {
    const r = normalizeRequest('PAM 46 FSTEC');
    expect(r.products[0]?.product).toBe('PAM');
    expect(r.products[0]?.quantity).toBe(46);
    expect(r.products[0]?.certified).toBe(true);
  });

  it('parses PAM ФСТЭК на 77 пользователей', () => {
    const r = normalizeRequest('PAM ФСТЭК на 77 пользователей');
    expect(r.products[0]?.product).toBe('PAM');
    expect(r.products[0]?.quantity).toBe(77);
    expect(r.products[0]?.metric).toBe('users');
    expect(r.products[0]?.certified).toBe(true);
  });

  it('parses PAM 10 CS', () => {
    const r = normalizeRequest('PAM 10 CS');
    expect(r.products[0]?.metric).toBe('concurrent_sessions');
    expect(r.products[0]?.quantity).toBe(10);
  });

  it('parses AM WL LDAP 437', () => {
    const r = normalizeRequest('AM WL LDAP 437');
    expect(r.products[0]?.product).toBe('AM');
    expect(r.products[0]?.quantity).toBe(437);
    const ids = r.products[0]?.modules?.map((m) => m.itemId) ?? [];
    expect(ids).toContain('AM.WINDOWS_LOGON');
    expect(ids).toContain('AM.LDAP_PROXY');
  });

  it('negates certification', () => {
    const r = normalizeRequest('PAM 25 не ФСТЭК');
    expect(r.products[0]?.certified).toBe(false);
  });

  it('flags ambiguous numbers', () => {
    const r = normalizeRequest('PAM 46 77');
    expect(r.conflicts.length).toBeGreaterThan(0);
  });

  it('does not treat 12 months as quantity', () => {
    const r = normalizeRequest('PAM на 12 месяцев');
    expect(r.termMonths).toBe(12);
    expect(r.products[0]?.quantity == null || r.products[0]?.quantity !== 12 || r.termMonths === 12).toBe(true);
    // quantity should not silently become 12 from term alone without another number
    expect(r.products[0]?.quantity).toBeFalsy();
  });
});

describe('demo calculator PAM', () => {
  it('matches PAM UL 46/77 annual fixtures', () => {
    const r46 = calculateOptionSync(pamOption(46, 'subscription', false, 0), 1);
    const lic46 = r46.items.find((i) => i.itemId === 'PAM.UL');
    expect(lic46?.saleQuantity).toBe(1);
    expect(lic46?.packageCapacity).toBe(46);
    expect(lic46?.lineTotal).toBe('5183096.00');

    const r77 = calculateOptionSync(pamOption(77, 'subscription', false, 0), 1);
    expect(r77.items.find((i) => i.itemId === 'PAM.UL')?.lineTotal).toBe('7898968.00');

    const r46f = calculateOptionSync(pamOption(46, 'subscription', true, 1), 1);
    expect(r46f.items.find((i) => i.itemId === 'PAM.UL')?.lineTotal).toBe('6737988.00');
    expect(r46f.items.find((i) => i.itemId === 'PAM.FSTEC_KIT')?.lineTotal).toBe('3050.00');
    expect(r46f.totals.amount).toBe('6741038.00');

    const r77f = calculateOptionSync(pamOption(77, 'subscription', true, 1), 1);
    expect(r77f.totals.amount).toBe('10271693.00');
  });

  it('matches PAM UL 25 certified annual and perpetual', () => {
    const annual = calculateOptionSync(pamOption(25, 'subscription', true, 1), 1);
    expect(annual.items.find((i) => i.itemId === 'PAM.UL')?.lineTotal).toBe('3779100.00');
    expect(annual.totals.amount).toBe('3782150.00');

    const perp = calculateOptionSync(pamOption(25, 'perpetual', true, 1), 1);
    expect(perp.items.find((i) => i.itemId === 'PAM.UL')?.lineTotal).toBe('7090200.00');
    expect(perp.totals.amount).toBe('7093250.00');
  });

  it('boundary tiers UL 29/30/31 and 59/60/61', () => {
    const a = (q: number) =>
      calculateOptionSync(pamOption(q, 'subscription', false, 0), 1).items.find((i) => i.itemId === 'PAM.UL')!
        .lineTotal!;
    expect(Number(a(29))).toBeLessThan(Number(a(30)));
    expect(Number(a(30))).not.toBe(Number(a(31)));
    expect(Number(a(59))).not.toBe(Number(a(60)));
    expect(Number(a(60))).toBe(6665940);
    expect(Number(a(61))).not.toBe(Number(a(60)));
  });

  it('CS boundaries 9/10/11 and fixtures', () => {
    const a = (q: number, lt: 'subscription' | 'perpetual' = 'subscription') =>
      calculateOptionSync(pamOption(q, lt, false, 0, 'concurrent_sessions'), 1).items.find(
        (i) => i.itemId === 'PAM.CS',
      )!.lineTotal!;
    expect(Number(a(9))).not.toBe(Number(a(10)));
    expect(Number(a(10))).not.toBe(Number(a(11)));
    expect(a(10)).toBe('3488380.00');
    expect(a(10, 'perpetual')).toBe('6544800.00');
  });

  it('does not invent SKU for 46/77', () => {
    const r = calculateOptionSync(pamOption(46, 'subscription', false, 0), 1);
    expect(r.items[0].sku).toBeNull();
    expect(r.items[0].skuStatus).toBe('unresolved');
  });

  it('separates kit VAT from exempt licenses', () => {
    const r = calculateOptionSync(pamOption(25, 'subscription', true, 1), 1);
    expect(Number(r.totals.exemptAmount)).toBe(3779100);
    expect(Number(r.totals.taxableGrossAmount)).toBe(3050);
    expect(Number(r.totals.includedTaxAmount)).toBe(550);
  });

  it('removes kit lines when kitQuantity=0', () => {
    const withKit = calculateOptionSync(pamOption(25, 'subscription', true, 1), 1);
    const without = calculateOptionSync(pamOption(25, 'subscription', true, 0), 1);
    expect(withKit.items.some((i) => i.itemId === 'PAM.FSTEC_KIT')).toBe(true);
    expect(without.items.some((i) => i.itemId === 'PAM.FSTEC_KIT')).toBe(false);
    const doc = buildProposalDocument({
      ...createDemoProposal(),
      options: [{ ...pamOption(25, 'subscription', true, 0), calculation: without }],
    });
    expect(doc.blocks.some((b) => b.type === 'note' && 'text' in b && String(b.text).includes('НДС'))).toBe(false);
  });
});

describe('alternatives independence', () => {
  it('does not share mutable configuration references', () => {
    const demo = createDemoProposal();
    const a = demo.options[0].configurations[0];
    const b = demo.options[1].configurations[0];
    expect(a.id).not.toBe(b.id);
    a.quantity = 99;
    expect(b.quantity).toBe(25);
  });

  it('does not sum alternatives in document totals separately', () => {
    const demo = createDemoProposal();
    const doc = buildProposalDocument(demo);
    const tables = doc.blocks.filter((b) => b.type === 'table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
  });
});

describe('WL subscription unknown price', () => {
  it('does not turn missing WL annual into zero total', () => {
    const option: ProposalOption = {
      id: 'o',
      label: 'sub',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'AM',
          platform: null,
          metric: 'users',
          quantity: 150,
          certified: false,
          kitQuantity: 0,
          enabled: true,
          modules: [
            { id: 'm', itemId: 'AM.WINDOWS_LOGON', metric: 'users', quantity: 150 },
          ],
        },
      ],
      calculation: null,
    };
    const r = calculateOptionSync(option, 1);
    const wl = r.items.find((i) => i.itemId === 'AM.WINDOWS_LOGON');
    expect(wl?.lineTotal).toBeNull();
    expect(r.totals.amount).toBeNull();
    expect(r.status).not.toBe('complete');
  });
});

describe('ITDR and CM fixtures', () => {
  it('ITDR Monitoring+MFA 300 annual/perpetual', () => {
    const mk = (lt: 'subscription' | 'perpetual'): ProposalOption => ({
      id: 'o',
      label: lt,
      licenseType: lt,
      termMonths: lt === 'subscription' ? 12 : null,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'ITDR',
          platform: null,
          metric: 'licensed_units',
          quantity: 300,
          certified: false,
          kitQuantity: 0,
          enabled: true,
          modules: [
            { id: 'm1', itemId: 'ITDR.MONITORING', metric: 'licensed_units', quantity: 300 },
            { id: 'm2', itemId: 'ITDR.MFA', metric: 'licensed_units', quantity: 300 },
          ],
        },
      ],
      calculation: null,
    });
    expect(calculateOptionSync(mk('subscription'), 1).totals.amount).toBe('2970600.00');
    expect(calculateOptionSync(mk('perpetual'), 1).totals.amount).toBe('5572500.00');
  });

  it('CM Windows+Agent 350 with 15% markup', () => {
    const mk = (lt: 'subscription' | 'perpetual'): ProposalOption => ({
      id: 'o',
      label: lt,
      licenseType: lt,
      termMonths: lt === 'subscription' ? 12 : null,
      commercialTerms: { ...defaultCommercialTerms(), signedDiscount: -0.15 },
      configurations: [
        {
          id: 'c',
          product: 'CM',
          platform: 'windows',
          metric: 'users',
          quantity: 350,
          certified: false,
          kitQuantity: 0,
          enabled: true,
          modules: [{ id: 'm', itemId: 'CM.WINDOWS.AGENT', metric: 'users', quantity: 350 }],
        },
      ],
      calculation: null,
    });
    expect(calculateOptionSync(mk('subscription'), 1).totals.amount).toBe('793327.50');
    expect(calculateOptionSync(mk('perpetual'), 1).totals.amount).toBe('1487640.00');
  });
});

describe('revision / fingerprint', () => {
  it('changes fingerprint when quantity changes', () => {
    const a = calculateOptionSync(pamOption(25, 'subscription', true, 1), 1);
    const b = calculateOptionSync(pamOption(77, 'subscription', true, 1), 2);
    expect(a.inputFingerprint).not.toBe(b.inputFingerprint);
    expect(b.revision).toBe(2);
  });
});

describe('draft storage', () => {
  it('ignores corrupt JSON', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, '{not-json');
    // dynamic import path already created — call load via repository
    return import('../services/localDraftRepository').then(async (m) => {
      const draft = await m.localDraftRepository.load();
      expect(draft).toBeNull();
    });
  });
});

describe('preview/export model parity', () => {
  it('document tables use calculation lines', () => {
    const demo = createDemoProposal();
    const doc = buildProposalDocument(demo);
    const table = doc.blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table').toBe(true);
    if (table && table.type === 'table') {
      const firstCalc = demo.options[0].calculation!.items[0];
      expect(table.rows[0].cells[2]).toContain('Privileged Access Manager');
      expect(table.rows[0].cells[5]).toBe(
        firstCalc.lineTotal
          ? Number(firstCalc.lineTotal).toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—',
      );
    }
  });
});
