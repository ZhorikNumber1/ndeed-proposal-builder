import articlesCatalog from '../data/articlesCatalog.json';
import articleControlSeeds from '../data/articleControlSeeds.json';
import observedSkus from '../data/observedSkus.json';
import type {
  ArticleEntry,
  ArticleResolveInput,
  ArticleResolution,
  ArticlesCatalogFile,
  CustomerGroupId,
} from '../domain/articleTypes';
import type { ObservedSku, ProductCode } from '../domain/types';

const catalog = articlesCatalog as ArticlesCatalogFile;
const seeds = articleControlSeeds as ArticleEntry[];
const observed = observedSkus as ObservedSku[];

const AUTO_EXCLUDED_KINDS = new Set<ArticleEntry['kind']>([
  'special',
  'one_off',
  'implementation_cert',
]);

const UNRESOLVED_PAM_UL_CAPACITIES = new Set([46, 77]);

function productFromItemId(itemId: string): ProductCode | undefined {
  const prefix = itemId.split('.')[0];
  if (prefix === 'AM' || prefix === 'CM' || prefix === 'PAM' || prefix === 'ITDR') {
    return prefix;
  }
  return undefined;
}

function certificationTarget(certification: boolean | null | undefined): 'ordinary' | 'fstec' | null {
  if (certification === true) return 'fstec';
  if (certification === false) return 'ordinary';
  return null;
}

function matchesCertification(
  entry: ArticleEntry,
  certification: boolean | null | undefined,
): boolean {
  const target = certificationTarget(certification);
  if (target == null) return true;
  if (entry.certification == null) return target === 'ordinary';
  return entry.certification === target;
}

function matchesObservedCertification(obs: ObservedSku, certification: boolean | null | undefined): boolean {
  if (certification === true) return obs.certifiedEvidence === true;
  if (certification === false || certification === null) return obs.certifiedEvidence !== true;
  return true;
}

function matchesCustomerGroup(entry: ArticleEntry, customerGroupId?: CustomerGroupId): boolean {
  if (customerGroupId == null || customerGroupId === 'standard') {
    // Default / standard resolution must not pick specialized client columns
    // that were imported with customerGroupId=standard (Росатом, Россети, …).
    if (entry.kind === 'customer_variant') return false;
    return entry.customerGroupId === 'standard';
  }
  if (customerGroupId === 'gazprom') {
    return entry.customerGroupId === 'gazprom';
  }
  if (customerGroupId === 'fstec') {
    return entry.certification === 'fstec' && entry.customerGroupId === 'standard';
  }
  return entry.customerGroupId === customerGroupId;
}

function matchesLicenseTerms(
  entry: ArticleEntry,
  input: ArticleResolveInput,
): boolean {
  if (entry.licenseType !== input.licenseType) return false;
  if (entry.termMonths !== input.termMonths) return false;
  if (input.packageCapacity != null || entry.packageCapacity != null) {
    if (entry.packageCapacity !== input.packageCapacity) return false;
  }
  if (input.metric != null && entry.metric != null && entry.metric !== input.metric) return false;
  return true;
}

function entryPool(): ArticleEntry[] {
  if (catalog.importStatus === 'ok' && catalog.entries.length > 0) {
    return catalog.entries;
  }
  return seeds;
}

function filterEntries(pool: ArticleEntry[], input: ArticleResolveInput): ArticleEntry[] {
  const product = input.product ?? productFromItemId(input.itemId);
  return pool.filter((entry) => {
    if (entry.itemId !== input.itemId) return false;
    if (product != null && entry.product !== product) return false;
    if (AUTO_EXCLUDED_KINDS.has(entry.kind)) return false;
    if (entry.excludedByDefault) return false;
    if (!matchesCustomerGroup(entry, input.customerGroupId)) return false;
    if (!matchesLicenseTerms(entry, input)) return false;
    if (!matchesCertification(entry, input.certification)) return false;
    return true;
  });
}

function resolveFromObserved(input: ArticleResolveInput): ArticleResolution | null {
  const matches = observed.filter((obs) => {
    if (obs.itemId !== input.itemId) return false;
    if (obs.licenseType !== input.licenseType && obs.licenseType !== 'not_applicable') return false;
    if (obs.termMonths !== input.termMonths) return false;
    if (obs.packageCapacity != null || input.packageCapacity != null) {
      if (obs.packageCapacity !== input.packageCapacity) return false;
    }
    if (!matchesObservedCertification(obs, input.certification)) return false;
    return true;
  });

  if (matches.length === 1 && matches[0].sku) {
    return {
      status: 'found',
      sku: matches[0].sku,
      provenance: 'observed',
      skuStatus: 'observed_exact',
      entryId: null,
      issues: [],
      display: {
        sku: matches[0].sku,
        name: matches[0].labelExample,
      },
    };
  }

  return null;
}

function notFound(issues: string[] = []): ArticleResolution {
  return {
    status: 'not_found',
    sku: null,
    provenance: null,
    skuStatus: 'unresolved',
    entryId: null,
    issues,
  };
}

function foundFromEntry(entry: ArticleEntry, provenance: 'catalog' | 'control_seed'): ArticleResolution {
  return {
    status: 'found',
    sku: entry.sku,
    provenance,
    skuStatus: 'catalog_confirmed',
    entryId: entry.id,
    issues: entry.issues,
    display: {
      sku: entry.sku,
      name: entry.name,
    },
  };
}

function scoreEntry(entry: ArticleEntry): number {
  let score = 0;
  // Prefer primary license packs over warranty / update / review leftovers.
  if (entry.quality === 'confirmed') score += 10;
  if (entry.kind !== 'needs_review') score += 5;
  if (!/гарантия/i.test(entry.groupLabel ?? '')) score += 8;
  if (!/обновлен/i.test(entry.groupLabel ?? '') && !entry.issues.includes('update_sku')) score += 8;
  const role = entry.sources[0]?.columnRole;
  if (role === 'standard' || role === 'standard_fstec') score += 4;
  return score;
}

function pickBestEntries(matches: ArticleEntry[]): ArticleEntry[] {
  if (matches.length <= 1) return matches;
  let best = -Infinity;
  const ranked: ArticleEntry[] = [];
  for (const entry of matches) {
    const score = scoreEntry(entry);
    if (score > best) {
      best = score;
      ranked.length = 0;
      ranked.push(entry);
    } else if (score === best) {
      ranked.push(entry);
    }
  }
  return ranked;
}

export function resolveArticle(input: ArticleResolveInput): ArticleResolution {
  if (input.itemId === 'PAM.FSTEC_KIT') {
    return notFound(['FSTEC kit has no standalone SKU']);
  }

  if (
    input.itemId === 'PAM.UL' &&
    input.packageCapacity != null &&
    UNRESOLVED_PAM_UL_CAPACITIES.has(input.packageCapacity)
  ) {
    return notFound([`No catalog SKU for PAM UL package capacity ${input.packageCapacity}`]);
  }

  const pool = entryPool();
  const provenance = catalog.importStatus === 'ok' && catalog.entries.length > 0 ? 'catalog' : 'control_seed';
  const matches = pickBestEntries(filterEntries(pool, input));

  if (matches.length === 1) {
    return foundFromEntry(matches[0], provenance);
  }

  if (matches.length > 1) {
    const distinctSkus = new Set(matches.map((m) => m.sku));
    if (distinctSkus.size === 1) {
      return foundFromEntry(matches[0], provenance);
    }
    return {
      status: 'ambiguous',
      sku: null,
      provenance,
      skuStatus: 'unresolved',
      entryId: null,
      issues: [`Ambiguous article match for ${input.itemId}`, ...matches.map((m) => m.sku)],
    };
  }

  const observedMatch = resolveFromObserved(input);
  if (observedMatch) return observedMatch;

  return notFound([`No article match for ${input.itemId}`]);
}

export function findArticleBySku(sku: string): ArticleEntry | undefined {
  const normalized = sku.trim();
  const pool = [...entryPool(), ...seeds.filter((s) => s.seedKind === 'control_sample')];
  return pool.find((entry) => entry.sku === normalized);
}
