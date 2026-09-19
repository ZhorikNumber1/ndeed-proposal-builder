import observedSkus from '../data/observedSkus.json';
import calculatorMapping from '../data/calculatorMapping.json';
import { PRODUCT_DEFINITIONS } from '../data/products';
import type {
  CatalogItem,
  CatalogService,
  ObservedSku,
  ProductDefinition,
  SkuLookup,
  SkuResolution,
} from '../domain/types';
import { resolveArticle } from './articleResolver';

const skus = observedSkus as ObservedSku[];
const items = calculatorMapping.items as CatalogItem[];

export function resolveSkuSync(input: SkuLookup): SkuResolution {
  const articleResult = resolveArticle({
    itemId: input.itemId,
    licenseType: input.licenseType,
    termMonths: input.termMonths,
    packageCapacity: input.packageCapacity,
    certification: input.certified,
    customerGroupId: 'standard',
  });

  if (articleResult.status === 'found' && articleResult.sku) {
    return {
      sku: articleResult.sku,
      status: articleResult.skuStatus,
      labelExample: articleResult.display?.name,
    };
  }

  if (articleResult.status === 'ambiguous') {
    return {
      sku: null,
      status: 'unresolved',
      labelExample: articleResult.issues.join('; '),
    };
  }

  const matches = skus.filter((s) => {
    if (s.itemId !== input.itemId) return false;
    if (s.licenseType !== input.licenseType && s.licenseType !== 'not_applicable') return false;
    if (s.termMonths !== input.termMonths) return false;
    if (s.packageCapacity != null || input.packageCapacity != null) {
      if (s.packageCapacity !== input.packageCapacity) return false;
    }
    if (input.certified === true) {
      if (s.certifiedEvidence !== true) return false;
    } else if (input.certified === false || input.certified === null) {
      if (s.certifiedEvidence === true) return false;
    }
    return true;
  });

  if (matches.length === 1 && matches[0].sku) {
    return {
      sku: matches[0].sku,
      status: 'observed_exact',
      labelExample: matches[0].labelExample,
    };
  }

  const cat = items.find((i) => i.itemId === input.itemId);
  return {
    sku: null,
    status: 'unresolved',
    labelExample: cat?.sourceLabel,
  };
}

export const catalogService: CatalogService = {
  async getProducts(): Promise<ProductDefinition[]> {
    return PRODUCT_DEFINITIONS;
  },
  async resolveSku(input: SkuLookup): Promise<SkuResolution> {
    return resolveSkuSync(input);
  },
};

export function getCatalogItem(itemId: string): CatalogItem | undefined {
  return items.find((i) => i.itemId === itemId);
}
