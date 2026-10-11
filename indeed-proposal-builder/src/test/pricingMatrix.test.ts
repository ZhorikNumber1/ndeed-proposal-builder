import { describe, expect, it } from 'vitest';
import { calculateOptionSync } from '../domain/calculateOption';
import {
  AM_BASE_TIERS,
  AM_MODULE_TIERS,
  CM_WINDOWS_BASE_TIERS,
  CM_WINDOWS_MODULE_TIERS,
  ITDR_MFA_ANNUAL,
  ITDR_MFA_PERPETUAL,
  ITDR_MONITORING_ANNUAL,
  ITDR_MONITORING_PERPETUAL,
  PAM_CS_TIERS,
  PAM_UL_TIERS,
  averageUnitCost,
  unitPriceFromU,
  unitPriceItdr,
} from '../domain/pricing';
import type { Configuration, ProposalOption } from '../domain/types';
import { defaultCommercialTerms } from '../data/demoProposal';

/**
 * Expected list totals from ACTIVE `RUB ALL *` formulas (A1≠да, G2 ignored).
 * Anchors: PAM UL I35:K40 / CS L35:N40; AM I7:N12; CM I20:N24; ITDR I46:N53.
 */
function expectedPam(
  metric: 'users' | 'concurrent_sessions',
  qty: number,
  licenseType: 'subscription' | 'perpetual',
  c = 1,
): string {
  const tiers = metric === 'concurrent_sessions' ? PAM_CS_TIERS : PAM_UL_TIERS;
  const U = averageUnitCost(qty, tiers);
  const unit = unitPriceFromU(U, licenseType, c);
  return (unit * qty).toFixed(2);
}

function expectedAmBase(qty: number, licenseType: 'subscription' | 'perpetual', c = 1): string {
  const U = averageUnitCost(qty, AM_BASE_TIERS);
  return (unitPriceFromU(U, licenseType, c) * qty).toFixed(2);
}

function expectedAmModule(
  qty: number,
  licenseType: 'subscription' | 'perpetual',
  c = 1,
  multiplier = 1,
): string {
  const U = averageUnitCost(qty, AM_MODULE_TIERS);
  return (unitPriceFromU(U, licenseType, c, { multiplier }) * qty).toFixed(2);
}

function expectedCmWinBase(qty: number, licenseType: 'subscription' | 'perpetual', c = 1): string {
  const U = averageUnitCost(qty, CM_WINDOWS_BASE_TIERS);
  return (unitPriceFromU(U, licenseType, c) * qty).toFixed(2);
}

function expectedCmWinMod(qty: number, licenseType: 'subscription' | 'perpetual', c = 1): string {
  const U = averageUnitCost(qty, CM_WINDOWS_MODULE_TIERS);
  return (unitPriceFromU(U, licenseType, c) * qty).toFixed(2);
}

function expectedItdr(
  kind: 'MFA' | 'MONITORING',
  qty: number,
  licenseType: 'subscription' | 'perpetual',
  c = 1,
): string {
  const tiers =
    kind === 'MFA'
      ? licenseType === 'subscription'
        ? ITDR_MFA_ANNUAL
        : ITDR_MFA_PERPETUAL
      : licenseType === 'subscription'
        ? ITDR_MONITORING_ANNUAL
        : ITDR_MONITORING_PERPETUAL;
  const U = averageUnitCost(qty, tiers);
  return (unitPriceItdr(U, c) * qty).toFixed(2);
}

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
    label: licenseType,
    licenseType,
    termMonths: licenseType === 'subscription' ? 12 : null,
    commercialTerms: defaultCommercialTerms(),
    configurations: [cfg],
    calculation: null,
  };
}

describe.each([
  { metric: 'concurrent_sessions' as const, q: 10, lic: 'subscription' as const, sheet: 'RUB ALL ПОДПИСКА E35' },
  { metric: 'concurrent_sessions' as const, q: 10, lic: 'perpetual' as const, sheet: 'RUB ALL БЕССРОЧНАЯ E35' },
  { metric: 'concurrent_sessions' as const, q: 25, lic: 'subscription' as const, sheet: 'RUB ALL ПОДПИСКА CS25' },
  { metric: 'users' as const, q: 60, lic: 'subscription' as const, sheet: 'RUB ALL ПОДПИСКА E33' },
  { metric: 'users' as const, q: 25, lic: 'subscription' as const, sheet: 'RUB ALL ПОДПИСКА UL25' },
  { metric: 'users' as const, q: 100, lic: 'perpetual' as const, sheet: 'RUB ALL БЕССРОЧНАЯ UL100' },
  { metric: 'users' as const, q: 5, lic: 'subscription' as const, sheet: 'RUB ALL ПОДПИСКА UL5' },
])('PAM list price $sheet q=$q $lic', ({ metric, q, lic }) => {
  it('matches ACTIVE ladder ROUNDUP path', () => {
    const calc = calculateOptionSync(pamOption(metric, q, lic), 1);
    expect(calc.totals.amount).toBe(expectedPam(metric, q, lic));
    expect(calc.status).toBe('complete');
  });
});

describe('PAM certification c=1.3 (A1=да)', () => {
  it('CS10 subscription uplifts inside ROUNDUP', () => {
    const calc = calculateOptionSync(pamOption('concurrent_sessions', 10, 'subscription', true), 1);
    expect(calc.totals.amount).toBe(expectedPam('concurrent_sessions', 10, 'subscription', 1.3));
  });
});

describe.each([
  { q: 100, lic: 'subscription' as const },
  { q: 500, lic: 'subscription' as const },
  { q: 1000, lic: 'perpetual' as const },
])('AM.BASE q=$q $lic (RUB ALL AM I7:K12 / N4=121%)', ({ q, lic }) => {
  it('matches base ladder', () => {
    const option: ProposalOption = {
      id: 'am',
      label: lic,
      licenseType: lic,
      termMonths: lic === 'subscription' ? 12 : null,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'AM',
          platform: null,
          metric: 'users',
          quantity: q,
          certified: false,
          kitQuantity: 0,
          modules: [],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    const base = calc.items.find((i) => i.itemId === 'AM.BASE');
    expect(base?.lineTotal).toBe(expectedAmBase(q, lic));
  });
});

describe.each([
  { itemId: 'AM.WINDOWS_LOGON' as const, mult: 1 },
  { itemId: 'AM.LINUX_LOGON' as const, mult: 1 },
  { itemId: 'AM.ESSO' as const, mult: 2 },
])('AM module $itemId (module ladder / ESSO×2)', ({ itemId, mult }) => {
  it('prices from AM_MODULE_TIERS with multiplier', () => {
    const q = 100;
    const option: ProposalOption = {
      id: 'am',
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
          quantity: q,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm', itemId, metric: 'users', quantity: q }],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    const mod = calc.items.find((i) => i.itemId.includes('LOGON') || i.itemId === 'AM.ESSO');
    expect(mod?.lineTotal).toBe(expectedAmModule(q, 'subscription', 1, mult));
  });
});

describe.each([
  { q: 100, lic: 'subscription' as const },
  { q: 500, lic: 'perpetual' as const },
])('CM Windows base q=$q $lic (I20:K24 / N14=132%)', ({ q, lic }) => {
  it('matches CM Windows base', () => {
    const option: ProposalOption = {
      id: 'cm',
      label: lic,
      licenseType: lic,
      termMonths: lic === 'subscription' ? 12 : null,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'CM',
          platform: 'windows',
          metric: 'users',
          quantity: q,
          certified: false,
          kitQuantity: 0,
          modules: [],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    const base = calc.items.find((i) => i.itemId === 'CM.WINDOWS.BASE');
    expect(base?.lineTotal).toBe(expectedCmWinBase(q, lic));
  });
});

describe('CM Windows agent module', () => {
  it('matches module ladder for q=100 subscription', () => {
    const q = 100;
    const option: ProposalOption = {
      id: 'cm',
      label: 'sub',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'CM',
          platform: 'windows',
          metric: 'users',
          quantity: q,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm', itemId: 'CM.WINDOWS.AGENT', metric: 'users', quantity: q }],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    const mod = calc.items.find((i) => i.itemId === 'CM.WINDOWS.AGENT');
    expect(mod?.lineTotal).toBe(expectedCmWinMod(q, 'subscription'));
  });
});

describe('CM multiplatform remains needs_rule', () => {
  it('does not invent multi ×1.4 pricing', () => {
    const option: ProposalOption = {
      id: 'cm',
      label: 'sub',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'CM',
          platform: 'multiplatform',
          metric: 'users',
          quantity: 100,
          certified: false,
          kitQuantity: 0,
          modules: [],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    expect(calc.status).toBe('needs_rule');
    expect(calc.issues.some((i) => i.code === 'cm_multi_needs_rule')).toBe(true);
  });
});

describe.each([
  { kind: 'MFA' as const, q: 100, lic: 'subscription' as const },
  { kind: 'MFA' as const, q: 1000, lic: 'perpetual' as const },
  { kind: 'MONITORING' as const, q: 100, lic: 'subscription' as const },
  { kind: 'MONITORING' as const, q: 5000, lic: 'subscription' as const },
])('ITDR.$kind q=$q $lic (no 0.533; N43=110%)', ({ kind, q, lic }) => {
  it('matches ITDR annual/perp ladders', () => {
    const itemId = kind === 'MFA' ? 'ITDR.MFA' : 'ITDR.MONITORING';
    const modules =
      kind === 'MFA'
        ? [
            { id: 'm1', itemId: 'ITDR.MONITORING' as const, metric: 'licensed_units' as const, quantity: q },
            { id: 'm2', itemId: 'ITDR.MFA' as const, metric: 'licensed_units' as const, quantity: q },
          ]
        : [{ id: 'm1', itemId: 'ITDR.MONITORING' as const, metric: 'licensed_units' as const, quantity: q }];
    const option: ProposalOption = {
      id: 'itdr',
      label: lic,
      licenseType: lic,
      termMonths: lic === 'subscription' ? 12 : null,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'ITDR',
          platform: null,
          metric: 'licensed_units',
          quantity: q,
          certified: false,
          kitQuantity: 0,
          modules,
          enabled: true,
        },
      ],
      calculation: null,
    };
    const calc = calculateOptionSync(option, 1);
    const line = calc.items.find((i) => i.itemId === itemId);
    expect(line?.lineTotal).toBe(expectedItdr(kind, q, lic));
  });
});

describe('unsupported term → needs_rule', () => {
  it('PAM subscription 24 months', () => {
    const opt = pamOption('users', 60, 'subscription');
    opt.termMonths = 24;
    const calc = calculateOptionSync(opt, 1);
    expect(calc.status).toBe('needs_rule');
    expect(calc.issues.some((i) => /term_needs_rule|срок/i.test(i.code + i.message))).toBe(true);
  });
});
