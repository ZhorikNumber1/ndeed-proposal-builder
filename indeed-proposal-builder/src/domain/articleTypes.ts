import type { LicenseType, Metric, ProductCode } from './types';

export type ArticleImportStatus = 'ok' | 'missing_source' | 'error';

export type ArticleEntryKind =
  | 'perpetual_base'
  | 'subscription'
  | 'module'
  | 'package_ul'
  | 'package_cs'
  | 'implementation_cert'
  | 'special'
  | 'one_off'
  | 'customer_variant'
  | 'needs_review';

export type ArticleEntryQuality = 'confirmed' | 'needs_review' | 'ambiguous';

export type CustomerGroupId = 'standard' | 'gazprom' | 'fstec';

export type ArticleSeedKind = 'control_sample';

export interface ArticleSource {
  sheet: string;
  cell: string;
  columnRole?: string;
}

export interface ArticleEntry {
  id: string;
  sku: string;
  name: string;
  product: ProductCode;
  kind: ArticleEntryKind;
  itemId: string | null;
  licenseType: LicenseType | 'not_applicable' | null;
  termMonths: number | null;
  packageCapacity: number | null;
  metric: Metric | null;
  certification: 'ordinary' | 'fstec' | null;
  customerGroupId: CustomerGroupId;
  quality: ArticleEntryQuality;
  sources: ArticleSource[];
  issues: string[];
  excludedByDefault: boolean;
  groupLabel?: string | null;
  seedKind?: ArticleSeedKind;
}

export interface ArticlesCatalogSource {
  fileName: string;
  fileHash: string;
  importedAt: string;
}

export interface ArticlesCatalogFile {
  catalogVersion: string | null;
  source: ArticlesCatalogSource | null;
  importStatus: ArticleImportStatus;
  entries: ArticleEntry[];
  specialExcludedByDefault: true;
}

export type ArticleResolutionStatus = 'found' | 'not_found' | 'ambiguous' | 'excluded';

export interface ArticleResolveInput {
  product?: ProductCode;
  itemId: string;
  metric?: Metric | null;
  licenseType: LicenseType | 'not_applicable';
  termMonths: number | null;
  certification?: boolean | null;
  packageCapacity?: number | null;
  customerGroupId?: CustomerGroupId;
}

export interface ArticleResolution {
  status: ArticleResolutionStatus;
  sku: string | null;
  provenance: 'catalog' | 'control_seed' | 'observed' | null;
  skuStatus: 'catalog_confirmed' | 'observed_exact' | 'unresolved';
  entryId: string | null;
  issues: string[];
  display?: {
    sku: string;
    name: string;
  };
}

export interface ArticlesImportReport {
  status: ArticleImportStatus;
  message: string;
  importedAt: string | null;
  rowCount: number;
  fileName?: string | null;
  fileHash?: string | null;
  sheetStats?: Record<string, number>;
  issues?: string[];
}
