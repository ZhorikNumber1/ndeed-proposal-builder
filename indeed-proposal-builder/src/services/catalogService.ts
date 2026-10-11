import calculatorMapping from '../data/calculatorMapping.json';
import { PRODUCT_DEFINITIONS } from '../data/products';
import type {
  CatalogItem,
  CatalogService,
  ProductDefinition,
  SkuLookup,
  SkuResolution,
} from '../domain/types';
import { resolveArticle } from './articleResolver';

const items = calculatorMapping.items as CatalogItem[];

export function resolveSkuSync(input: SkuLookup): SkuResolution {
  const articleResult = resolveArticle({
    itemId: input.itemId,
    licenseType: input.licenseType,
    termMonths: input.termMonths,
    packageCapacity: input.packageCapacity,
    certification: input.certified,
    customerGroupId: input.customerGroupId ?? 'standard',
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

  // articleResolver already consulted observed fixtures with catalog eligibility rules.
  // Do not re-apply raw observedSkus here — that would resurrect special/missing codes
  // (e.g. PAM-02120010 / PAM-02000010) after a deliberate not_found.
  const cat = items.find((i) => i.itemId === input.itemId);
  return {
    sku: null,
    status: 'unresolved',
    labelExample: articleResult.issues[0] ?? cat?.sourceLabel,
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
