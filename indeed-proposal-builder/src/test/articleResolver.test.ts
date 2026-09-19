import { describe, expect, it } from 'vitest';
import articleControlSeeds from '../data/articleControlSeeds.json';
import { resolveArticle, findArticleBySku } from '../services/articleResolver';
import { resolveSkuSync } from '../services/catalogService';
import type { ArticleEntry } from '../domain/articleTypes';

const seeds = articleControlSeeds as ArticleEntry[];

describe('articleResolver PAM UL25', () => {
  it('resolves PAM UL25 year ordinary to PAM-01120025', () => {
    const result = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 25,
      certification: false,
    });
    expect(result.status).toBe('found');
    expect(result.sku).toBe('PAM-01120025');
    expect(result.skuStatus).toBe('catalog_confirmed');
    expect(result.provenance).toBe('control_seed');
  });

  it('resolves PAM UL25 year FSTEC to PF-01120025', () => {
    const result = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 25,
      certification: true,
    });
    expect(result.status).toBe('found');
    expect(result.sku).toBe('PF-01120025');
    expect(result.skuStatus).toBe('catalog_confirmed');
  });

  it('does not invent SKU for PAM UL46', () => {
    const result = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 46,
      certification: false,
    });
    expect(result.status).toBe('not_found');
    expect(result.sku).toBeNull();
    expect(result.skuStatus).toBe('unresolved');
  });

  it('does not invent SKU for PAM UL77', () => {
    const result = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 77,
      certification: true,
    });
    expect(result.status).toBe('not_found');
    expect(result.sku).toBeNull();
  });
});

describe('articleResolver ITDR seeds', () => {
  it('finds hyphenless ITDR subscription codes in seeds', () => {
    expect(findArticleBySku('ITDR01120001')?.itemId).toBe('ITDR.MONITORING');
    expect(findArticleBySku('ITDR02120001')?.itemId).toBe('ITDR.MFA');
    expect(findArticleBySku('ITDR01240001')?.termMonths).toBe(24);
    expect(findArticleBySku('ITDR02240001')?.termMonths).toBe(24);
  });

  it('resolves ITDR monitoring perpetual via hyphenated seed', () => {
    const result = resolveArticle({
      itemId: 'ITDR.MONITORING',
      licenseType: 'perpetual',
      termMonths: null,
      packageCapacity: null,
      certification: false,
    });
    expect(result.status).toBe('found');
    expect(result.sku).toBe('ITDR-01-0001');
  });
});

describe('articleResolver Cyrillic preservation', () => {
  it('preserves Cyrillic А in АCM seed', () => {
    const entry = seeds.find((s) => s.sku.startsWith('АCM'));
    expect(entry?.sku).toBe('АCM-00000001');
    expect(entry?.sources[0]?.cell).toBe('F7');
  });

  it('preserves Cyrillic СВ in implementation cert seeds', () => {
    const svAm = seeds.find((s) => s.sku === 'СВ-AM-00001');
    const svCm = seeds.find((s) => s.sku === 'СВ-CM-00001');
    const svPam = seeds.find((s) => s.sku === 'СВ-PAM-0001');
    expect(svAm?.sku.startsWith('СВ-')).toBe(true);
    expect(svCm?.sku.startsWith('СВ-')).toBe(true);
    expect(svPam?.sku.startsWith('СВ-')).toBe(true);
  });

  it('preserves Gpam case in Gazprom PAM seed', () => {
    const entry = seeds.find((s) => s.sku === 'Gpam-01120025');
    expect(entry?.customerGroupId).toBe('gazprom');
    expect(entry?.sku).toBe('Gpam-01120025');
  });
});

describe('catalogService integration', () => {
  it('uses article resolver for PAM UL25 subscription ordinary', () => {
    const result = resolveSkuSync({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 25,
      certified: false,
    });
    expect(result.sku).toBe('PAM-01120025');
    expect(result.status).toBe('catalog_confirmed');
  });

  it('keeps PAM UL46 unresolved via catalogService', () => {
    const result = resolveSkuSync({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 46,
      certified: false,
    });
    expect(result.sku).toBeNull();
    expect(result.status).toBe('unresolved');
  });
});
