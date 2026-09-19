import type { Metric } from './types';
import { roundUp } from './money';

export interface Tier {
  from: number;
  rate: number;
}

/** Cumulative ladder: T(q) = sum of segments; U(q) = T(q)/q */
export function cumulativeCost(quantity: number, tiers: Tier[]): number {
  if (quantity <= 0) return 0;
  let total = 0;
  for (let i = 0; i < tiers.length; i++) {
    const from = tiers[i].from;
    const nextFrom = i + 1 < tiers.length ? tiers[i + 1].from : Infinity;
    const rate = tiers[i].rate;
    const count = Math.max(0, Math.min(quantity, nextFrom) - from);
    total += count * rate;
    if (quantity <= nextFrom) break;
  }
  return total;
}

export function averageUnitCost(quantity: number, tiers: Tier[]): number {
  if (quantity <= 0) return 0;
  return cumulativeCost(quantity, tiers) / quantity;
}

export const PAM_UL_TIERS: Tier[] = [
  { from: 0, rate: 218160 },
  { from: 30, rate: 198720 },
  { from: 60, rate: 136080 },
  { from: 180, rate: 125280 },
  { from: 240, rate: 103680 },
  { from: 600, rate: 95040 },
];

export const PAM_CS_TIERS: Tier[] = [
  { from: 0, rate: 654480 },
  { from: 10, rate: 591840 },
  { from: 20, rate: 408240 },
  { from: 60, rate: 373680 },
  { from: 80, rate: 291600 },
  { from: 200, rate: 237600 },
];

export const AM_BASE_TIERS: Tier[] = [
  { from: 0, rate: 3207 },
  { from: 500, rate: 2723 },
  { from: 1000, rate: 2178 },
  { from: 5000, rate: 1573 },
  { from: 10000, rate: 1271 },
];

export const AM_MODULE_TIERS: Tier[] = [
  { from: 0, rate: 2057 },
  { from: 500, rate: 1573 },
  { from: 1000, rate: 1150 },
  { from: 5000, rate: 908 },
  { from: 10000, rate: 605 },
];

export const CM_WINDOWS_BASE_TIERS: Tier[] = [
  { from: 0, rate: 3036 },
  { from: 500, rate: 2838 },
  { from: 1000, rate: 2574 },
  { from: 5000, rate: 2310 },
  { from: 10000, rate: 1980 },
];

export const CM_WINDOWS_MODULE_TIERS: Tier[] = [
  { from: 0, rate: 660 },
  { from: 500, rate: 396 },
  { from: 1000, rate: 330 },
  { from: 5000, rate: 317 },
  { from: 10000, rate: 317 },
];

export const ITDR_MFA_ANNUAL: Tier[] = [
  { from: 0, rate: 6601 },
  { from: 500, rate: 5500 },
  { from: 1000, rate: 4400 },
  { from: 3000, rate: 3851 },
  { from: 5000, rate: 3301 },
  { from: 10000, rate: 2750 },
  { from: 50000, rate: 1871 },
];

export const ITDR_MFA_PERPETUAL: Tier[] = [
  { from: 0, rate: 12383 },
  { from: 500, rate: 10320 },
  { from: 1000, rate: 8256 },
  { from: 3000, rate: 7224 },
  { from: 5000, rate: 6192 },
  { from: 10000, rate: 5159 },
  { from: 50000, rate: 3508 },
];

export const ITDR_MONITORING_ANNUAL: Tier[] = [
  { from: 0, rate: 3301 },
  { from: 1000, rate: 2971 },
  { from: 3000, rate: 2750 },
  { from: 5000, rate: 2420 },
  { from: 10000, rate: 2200 },
  { from: 15000, rate: 1981 },
  { from: 20000, rate: 1871 },
  { from: 50000, rate: 1651 },
];

export const ITDR_MONITORING_PERPETUAL: Tier[] = [
  { from: 0, rate: 6192 },
  { from: 1000, rate: 5573 },
  { from: 3000, rate: 5159 },
  { from: 5000, rate: 4541 },
  { from: 10000, rate: 4128 },
  { from: 15000, rate: 3715 },
  { from: 20000, rate: 3508 },
  { from: 50000, rate: 3096 },
];

export const FSTEC_KIT = {
  gross: 3050,
  vat: 550,
  vatRate: 0.22,
  net: 2500,
} as const;

export const CALCULATOR_PROVENANCE = {
  calculatorVersion: 'demo-extracted-S08',
  engineVersion: 'indeed-proposal-builder/1.0.0-demo',
  sourceHash: 'd1fcd56cf9964d7d10de5fb251ad08354f93899f6f76a9cd7a1c512a94909435',
  sourceFile: 'price-calculator NEW.xlsx',
} as const;

/**
 * Standard annual/perpetual unit price from average U and certification factor c.
 * Annual: ceil(U × 0.533 × c); Perpetual: ceil(U) × c (decimals after c allowed).
 */
export function unitPriceFromU(
  U: number,
  licenseType: 'subscription' | 'perpetual',
  c: number,
  opts?: { annualFactor?: number; multiplier?: number },
): number {
  const factor = opts?.annualFactor ?? 0.533;
  const mult = opts?.multiplier ?? 1;
  if (licenseType === 'subscription') {
    return roundUp(U * factor * c * mult);
  }
  return Math.ceil(U) * c * mult;
}

/** ITDR: ceil(U × c) — no 0.533 factor. */
export function unitPriceItdr(U: number, c: number): number {
  return roundUp(U * c);
}

export function applySignedDiscount(unitPrice: number, signedDiscount: number): number {
  return unitPrice * (1 - signedDiscount);
}

export function metricLabel(metric: Metric): string {
  switch (metric) {
    case 'users':
      return 'пользователей';
    case 'concurrent_sessions':
      return 'одновременных подключений';
    case 'resources':
      return 'ресурсных лицензий';
    case 'licensed_units':
      return 'лицензий';
    case 'service_accounts':
      return 'учётных записей';
    case 'permissions':
      return 'разрешений';
    case 'packages':
      return 'пакетов';
    case 'kits':
      return 'комплектов';
    default:
      return 'ед.';
  }
}
