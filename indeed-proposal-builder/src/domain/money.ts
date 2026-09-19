import type { Money } from './types';

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerMoneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Parse a decimal money string to number of rubles (may have kopecks). */
export function moneyToNumber(value: Money | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Format to Money string with exactly 2 decimal places, avoiding float noise. */
export function toMoney(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid money value');
  }
  // Round to kopecks via integer math
  const kopecks = Math.round(value * 100 + Number.EPSILON);
  const sign = kopecks < 0 ? '-' : '';
  const abs = Math.abs(kopecks);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

export function formatMoney(value: Money | number | null | undefined, opts?: { fallback?: string }): string {
  if (value == null || value === '') return opts?.fallback ?? '—';
  const n = typeof value === 'number' ? value : moneyToNumber(value);
  if (n == null) return opts?.fallback ?? '—';
  return `${moneyFormatter.format(n)} ₽`;
}

export function formatMoneyPlain(value: Money | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : moneyToNumber(value);
  if (n == null) return '—';
  return moneyFormatter.format(n);
}

export function formatIntegerRub(value: number): string {
  return integerMoneyFormatter.format(value);
}

export function addMoney(a: Money, b: Money): Money {
  return toMoney((moneyToNumber(a) ?? 0) + (moneyToNumber(b) ?? 0));
}

export function sumMoney(values: Array<Money | null | undefined>): Money {
  let total = 0;
  for (const v of values) {
    const n = moneyToNumber(v);
    if (n != null) total += n;
  }
  return toMoney(total);
}

export function multiplyMoney(unit: number, qty: number): Money {
  return toMoney(unit * qty);
}

/** Excel-like ROUNDUP to 0 decimal places for positive numbers. */
export function roundUp(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value <= 0) return Math.ceil(value);
  // Match Excel ROUNDUP sensitivity to binary float for tariff formulas
  return Math.ceil(value - 1e-10);
}
