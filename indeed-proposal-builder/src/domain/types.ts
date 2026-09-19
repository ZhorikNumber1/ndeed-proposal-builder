export type ProductCode = 'AM' | 'CM' | 'PAM' | 'ITDR';
export type LicenseType = 'subscription' | 'perpetual';
export type Platform = 'windows' | 'multiplatform' | null;
export type Metric =
  | 'users'
  | 'concurrent_sessions'
  | 'resources'
  | 'licensed_units'
  | 'service_accounts'
  | 'permissions'
  | 'packages'
  | 'kits';

/** Decimal money string, e.g. "6741038.00" */
export type Money = string;

export type Validity =
  | { kind: 'days'; days: number }
  | { kind: 'calendar_months'; months: number }
  | { kind: 'purchase_year'; year: number };

export interface SourceRef {
  sourceId: string;
  locator: string;
}

export interface ModuleSelection {
  id: string;
  itemId: string;
  metric: Metric;
  quantity: number;
}

export interface Configuration {
  id: string;
  product: ProductCode;
  platform: Platform;
  metric: Metric;
  quantity: number;
  certified: boolean | null;
  kitQuantity: number;
  modules: ModuleSelection[];
  enabled: boolean;
}

export interface CommercialTerms {
  /** .15 = 15% discount; -.15 = 15% markup */
  signedDiscount: number;
  supportSignedDiscount: number;
  adjustmentReason: string | null;
  supportIncludedMonths: number;
  supportExtraYears: number;
  exceptions: Array<{ ruleId: string; reason: string; reference: string }>;
}

export interface Tax {
  mode: 'exempt' | 'included' | 'unresolved';
  rate: number | null;
  amount: Money | null;
  basisSource: SourceRef[];
}

export interface QuoteLine {
  id: string;
  configurationId: string;
  itemId: string;
  sku: string | null;
  skuStatus: 'observed_exact' | 'catalog_confirmed' | 'unresolved';
  description: string;
  calculatorQuantity: number;
  calculatorUnitPrice: Money | null;
  packageCapacity: number | null;
  saleQuantity: number;
  saleUnit: 'license' | 'package' | 'kit';
  unitPrice: Money | null;
  lineTotal: Money | null;
  tax: Tax;
  sourceRefs: SourceRef[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  blocksRelease: boolean;
  fieldPath?: string;
  configurationId?: string;
  optionId?: string;
  sourceRefs?: SourceRef[];
}

export interface CalculationResult {
  optionId: string;
  revision: number;
  inputFingerprint: string;
  mode: 'demo' | 'api';
  status: 'complete' | 'partial' | 'needs_rule' | 'error';
  items: QuoteLine[];
  totals: {
    amount: Money | null;
    knownSubtotal: Money;
    exemptAmount: Money;
    taxableGrossAmount: Money;
    includedTaxAmount: Money | null;
  };
  issues: ValidationIssue[];
  provenance: {
    calculatorVersion: string;
    engineVersion: string;
    sourceHash?: string;
  };
}

export interface ProposalOption {
  id: string;
  label: string;
  licenseType: LicenseType;
  termMonths: number | null;
  commercialTerms: CommercialTerms;
  configurations: Configuration[];
  calculation: CalculationResult | null;
}

export interface Proposal {
  schemaVersion: 1;
  id: string;
  number: string;
  /** YYYY-MM-DD */
  issueDate: string;
  rawRequest: string;
  customer: { legalName: string };
  manager: { displayName: string };
  supplierProfileId: string;
  currency: 'RUB';
  validity: Validity;
  options: ProposalOption[];
  status: 'draft' | 'needs_input' | 'needs_rule' | 'ready_for_review';
  issues: ValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProfile {
  id: string;
  version: string;
  legalName: string;
  address: string;
  inn: string;
  ogrn: string;
  kpp: string;
  signatoryName: string;
  signatoryRole: string;
  supportPhone: string;
  supportUrl: string;
  certificateNumber: string | null;
  isDemo: boolean;
}

export interface BuilderUiState {
  activeStep: 1 | 2 | 3 | 4;
  activeOptionId: string;
  sidebarCollapsed: boolean;
  previewExpanded: boolean;
  dirty: boolean;
  calculationPending: boolean;
  exportPending: 'docx' | 'pdf' | null;
  toast: string | null;
  showHelp: boolean;
  showIssues: boolean;
  draftRestorePrompt: boolean;
  parseCandidate: ParseCandidate | null;
}

export interface CatalogItem {
  itemId: string;
  product: ProductCode;
  label: string;
  platform: Platform;
  metric: Metric;
  saleRepresentation: 'units' | 'package_1' | 'requires_catalog_definition';
  subscriptionRow: number;
  perpetualRow: number;
  sourceLabel: string;
}

export interface ObservedSku {
  sku: string | null;
  itemId: string;
  licenseType: LicenseType | 'not_applicable';
  termMonths: number | null;
  packageCapacity: number | null;
  certifiedEvidence: boolean | null;
  labelExample: string;
  sources: Array<{ sourceId: string; locator: string }>;
}

export interface ContentBlock {
  id: string;
  version: number;
  section: string;
  title: string;
  condition: Record<string, unknown>;
  paragraphs: string[];
  variables: string[];
  sourceRefs: Array<{ sourceId: string; locator: string }>;
  notes: string | null;
}

export interface ParseToken {
  id: string;
  kind: string;
  label: string;
  value: unknown;
  confirmed: boolean;
  ambiguous?: boolean;
}

export interface ParseCandidate {
  raw: string;
  tokens: ParseToken[];
  products: Array<Partial<Configuration> & { product: ProductCode }>;
  modules: Array<{ itemId: string; quantity: number | null; quantityInferred: boolean }>;
  conflicts: string[];
  unrecognized: string[];
  questions: string[];
  termMonths: number | null;
  licenseType: LicenseType | null;
}

export type DocumentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string; emphasis?: 'note' | 'normal' }
  | { type: 'list'; ordered: boolean; items: string[] }
  | {
      type: 'table';
      title: string;
      optionId: string;
      headers: string[];
      rows: Array<{ cells: string[]; isTotal?: boolean }>;
      footnote?: string;
    }
  | { type: 'note'; text: string }
  | { type: 'signature'; lines: string[] }
  | { type: 'meta'; left: string; center: string; right: string }
  | { type: 'supplierHeader'; lines: string[] }
  | { type: 'demoBanner'; text: string };

export interface ProposalDocument {
  fileBaseName: string;
  isDemo: boolean;
  unresolvedNotes: string[];
  blocks: DocumentBlock[];
}

export interface StoredDraft {
  schemaVersion: 1;
  savedAt: string;
  proposal: Proposal;
  ui: Pick<BuilderUiState, 'activeStep' | 'activeOptionId' | 'sidebarCollapsed'>;
}

export interface SkuLookup {
  itemId: string;
  licenseType: LicenseType | 'not_applicable';
  termMonths: number | null;
  packageCapacity: number | null;
  certified: boolean | null;
}

export interface SkuResolution {
  sku: string | null;
  status: QuoteLine['skuStatus'];
  labelExample?: string;
}

export interface ProductDefinition {
  code: ProductCode;
  name: string;
  fullName: string;
  metrics: Metric[];
  modules: CatalogItem[];
}

export interface CalculatorService {
  calculate(
    option: ProposalOption,
    context: { revision: number; signal?: AbortSignal },
  ): Promise<CalculationResult>;
}

export interface CatalogService {
  getProducts(): Promise<ProductDefinition[]>;
  resolveSku(input: SkuLookup): Promise<SkuResolution>;
}

export interface DraftRepository {
  load(): Promise<StoredDraft | null>;
  save(draft: StoredDraft): Promise<void>;
  clear(): Promise<void>;
}

export interface ExportService {
  toDocx(document: ProposalDocument): Promise<Blob>;
  toPdf(document: ProposalDocument): Promise<Blob>;
}
