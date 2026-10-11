import { describe, expect, it } from 'vitest';
import { findArticleBySku, resolveArticle } from '../services/articleResolver';
import { resolveSkuSync } from '../services/catalogService';
import articlesCatalog from '../data/articlesCatalog.json';
import type { ArticlesCatalogFile } from '../domain/articleTypes';

const catalog = articlesCatalog as ArticlesCatalogFile;

describe('registry anchors (артикулы_09.04.2026)', () => {
  it('PAM-01120060 is PAM!C300 standard package_ul', () => {
    const e = findArticleBySku('PAM-01120060');
    expect(e?.sources[0]?.sheet).toBe('PAM');
    expect(e?.sources[0]?.cell).toBe('C300');
    expect(e?.kind).toBe('package_ul');
    expect(e?.excludedByDefault).toBe(false);
  });

  it('PAM-02120025 is PAM!C364 standard package_cs', () => {
    const e = findArticleBySku('PAM-02120025');
    expect(e?.sources[0]?.cell).toBe('C364');
    expect(e?.kind).toBe('package_cs');
  });

  it('PAM-02120010 is absent from entire registry', () => {
    expect(catalog.entries.some((e) => e.sku === 'PAM-02120010')).toBe(false);
  });

  it('PAM-02000010 is special B63 one_off, excluded from auto-match', () => {
    const e = findArticleBySku('PAM-02000010');
    expect(e?.sources[0]?.sheet).toBe('разовыеуникальные артикулы');
    expect(e?.sources[0]?.cell).toBe('B63');
    expect(e?.kind).toBe('one_off');
    expect(e?.excludedByDefault).toBe(true);
  });

  it('PF-02120010 is special B58 one_off, excluded from auto-match', () => {
    const e = findArticleBySku('PF-02120010');
    expect(e?.sources[0]?.cell).toBe('B58');
    expect(e?.kind).toBe('one_off');
    expect(e?.excludedByDefault).toBe(true);
  });
});

describe('CS-10 and specials never auto-resolve as standard packs', () => {
  it('PAM.CS capacity 10 subscription → not_found (no PAM-02120010)', () => {
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
  });

  it('PAM.CS capacity 10 perpetual does not use special PAM-02000010', () => {
    const r = resolveArticle({
      itemId: 'PAM.CS',
      licenseType: 'perpetual',
      termMonths: null,
      packageCapacity: 10,
      certification: false,
      customerGroupId: 'standard',
    });
    expect(r.status).toBe('not_found');
    expect(r.sku).not.toBe('PAM-02000010');
    expect(r.sku).toBeNull();
  });

  it('catalogService also leaves CS10 unresolved', () => {
    const r = resolveSkuSync({
      itemId: 'PAM.CS',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 10,
      certified: false,
      customerGroupId: 'standard',
    });
    expect(r.sku).toBeNull();
    expect(r.status).toBe('unresolved');
  });
});

describe('customer group selection', () => {
  it('standard does not return gazprom / rosatom variants', () => {
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
  });

  it('gazprom returns Gpam family when present', () => {
    const r = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 25,
      certification: false,
      customerGroupId: 'gazprom',
    });
    expect(r.status).toBe('found');
    expect(r.sku?.toLowerCase().startsWith('gpam') || r.sku?.startsWith('Gpam')).toBe(true);
  });

  it('rosatom returns Apam variant for UL60 when present', () => {
    const r = resolveArticle({
      itemId: 'PAM.UL',
      licenseType: 'subscription',
      termMonths: 12,
      packageCapacity: 60,
      certification: false,
      customerGroupId: 'rosatom',
    });
    expect(r.status).toBe('found');
    expect(r.sku).toMatch(/^Apam-/i);
  });
});
