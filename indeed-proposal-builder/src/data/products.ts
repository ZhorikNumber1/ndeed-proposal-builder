import calculatorMapping from './calculatorMapping.json';
import type { CatalogItem, Metric, ProductCode, ProductDefinition } from '../domain/types';

export const PRODUCT_NAMES: Record<ProductCode, string> = {
  AM: 'Indeed Access Manager',
  CM: 'Indeed Certificate Manager',
  PAM: 'Indeed Privileged Access Manager',
  ITDR: 'Indeed ITDR',
};

const PAM_BASE_ITEM_IDS = new Set(['PAM.UL', 'PAM.CS', 'PAM.RL', 'PAM.FSTEC_KIT']);

function isBaseCatalogItem(item: CatalogItem): boolean {
  if (item.itemId.endsWith('.BASE')) return true;
  return PAM_BASE_ITEM_IDS.has(item.itemId);
}

export function buildProductDefinitions(): ProductDefinition[] {
  const items = calculatorMapping.items as CatalogItem[];
  const productCodes: ProductCode[] = ['AM', 'CM', 'PAM', 'ITDR'];

  return productCodes.map((code) => {
    const productItems = items.filter((item) => item.product === code);
    const metrics = [...new Set(productItems.map((item) => item.metric))] as Metric[];
    const modules = productItems.filter((item) => !isBaseCatalogItem(item));

    return {
      code,
      name: code,
      fullName: PRODUCT_NAMES[code],
      metrics,
      modules,
    };
  });
}

export const PRODUCT_DEFINITIONS = buildProductDefinitions();
