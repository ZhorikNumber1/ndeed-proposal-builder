import type {
  CalculationResult,
  CommercialTerms,
  Configuration,
  LicenseType,
  Money,
  ProposalOption,
  QuoteLine,
  Tax,
  ValidationIssue,
} from './types';
import { toMoney } from './money';
import {
  AM_BASE_TIERS,
  AM_MODULE_TIERS,
  CALCULATOR_PROVENANCE,
  CM_WINDOWS_BASE_TIERS,
  CM_WINDOWS_MODULE_TIERS,
  FSTEC_KIT,
  ITDR_MFA_ANNUAL,
  ITDR_MFA_PERPETUAL,
  ITDR_MONITORING_ANNUAL,
  ITDR_MONITORING_PERPETUAL,
  PAM_CS_TIERS,
  PAM_UL_TIERS,
  applySignedDiscount,
  averageUnitCost,
  metricLabel,
  unitPriceFromU,
  unitPriceItdr,
  type Tier,
} from './pricing';
import { resolveSkuSync } from '../services/catalogService';

const EXEMPT_TAX: Tax = {
  mode: 'exempt',
  rate: null,
  amount: null,
  basisSource: [{ sourceId: 'S08', locator: 'license-vat-note' }],
};

function fingerprint(option: ProposalOption): string {
  const payload = {
    id: option.id,
    licenseType: option.licenseType,
    termMonths: option.termMonths,
    terms: option.commercialTerms,
    configs: option.configurations.map((c) => ({
      id: c.id,
      product: c.product,
      platform: c.platform,
      metric: c.metric,
      quantity: c.quantity,
      certified: c.certified,
      kitQuantity: c.kitQuantity,
      enabled: c.enabled,
      modules: c.modules.map((m) => ({ itemId: m.itemId, quantity: m.quantity, metric: m.metric })),
    })),
  };
  return JSON.stringify(payload);
}

function lineDesc(
  itemId: string,
  label: string,
  qty: number,
  metric: Configuration['metric'],
  licenseType: LicenseType,
  termMonths: number | null,
  certified: boolean | null,
): string {
  const metricText = metricLabel(metric);
  let base = label;
  if (itemId.startsWith('PAM.') && (itemId === 'PAM.UL' || itemId === 'PAM.CS')) {
    base = `Неисключительные права на Программу для ЭВМ Indeed Privileged Access Manager (пакет на ${qty} ${metricText})`;
  } else if (itemId === 'PAM.FSTEC_KIT') {
    base = 'Сертифицированный ФСТЭК комплект Indeed Privileged Access Manager';
  } else {
    base = `Неисключительные права на ${label}`;
  }
  if (licenseType === 'subscription' && termMonths === 12) {
    base += ' на 1 (один) год';
  } else if (licenseType === 'subscription' && termMonths != null) {
    base += ` на ${termMonths} мес.`;
  }
  if (certified === true && itemId.startsWith('PAM.') && itemId !== 'PAM.FSTEC_KIT') {
    // certification reflected in kit / version, not always in label
  }
  return base;
}

interface PricedLine {
  line: QuoteLine;
  issues: ValidationIssue[];
}

function priceStandard(
  U: number,
  licenseType: LicenseType,
  c: number,
  signedDiscount: number,
  qty: number,
  opts?: { annualFactor?: number; multiplier?: number; keepDecimals?: boolean },
): { unitBefore: number; unitAfter: number; total: number } {
  let unitBefore: number;
  if (opts?.annualFactor === 1 && licenseType === 'subscription') {
    // ITDR path handled separately
    unitBefore = unitPriceItdr(U, c * (opts.multiplier ?? 1));
  } else {
    unitBefore = unitPriceFromU(U, licenseType, c, opts);
  }
  const unitAfter = applySignedDiscount(unitBefore, signedDiscount);
  const total = unitAfter * qty;
  return { unitBefore, unitAfter, total };
}

function buildLine(params: {
  id: string;
  configurationId: string;
  itemId: string;
  description: string;
  calculatorQuantity: number;
  packageCapacity: number | null;
  saleQuantity: number;
  saleUnit: QuoteLine['saleUnit'];
  unitPrice: number | null;
  lineTotal: number | null;
  tax: Tax;
  licenseType: LicenseType | 'not_applicable';
  termMonths: number | null;
  certified: boolean | null;
}): QuoteLine {
  const skuRes = resolveSkuSync({
    itemId: params.itemId,
    licenseType: params.licenseType,
    termMonths: params.termMonths,
    packageCapacity: params.packageCapacity,
    certified: params.certified,
  });
  return {
    id: params.id,
    configurationId: params.configurationId,
    itemId: params.itemId,
    sku: skuRes.sku,
    skuStatus: skuRes.status,
    description: params.description || skuRes.labelExample || params.itemId,
    calculatorQuantity: params.calculatorQuantity,
    calculatorUnitPrice: params.unitPrice != null ? toMoney(params.unitPrice) : null,
    packageCapacity: params.packageCapacity,
    saleQuantity: params.saleQuantity,
    saleUnit: params.saleUnit,
    unitPrice: params.unitPrice != null ? toMoney(params.unitPrice) : null,
    lineTotal: params.lineTotal != null ? toMoney(params.lineTotal) : null,
    tax: params.tax,
    sourceRefs: [{ sourceId: 'S08', locator: params.itemId }],
  };
}

function certificationFactor(certified: boolean | null): { c: number; issue?: ValidationIssue } {
  if (certified === true) return { c: 1.3 };
  // null / false → ordinary version (c=1). Explicit null no longer blocks pricing.
  return { c: 1 };
}

function pricePamBase(
  config: Configuration,
  option: ProposalOption,
  terms: CommercialTerms,
): PricedLine[] {
  const issues: ValidationIssue[] = [];
  const results: PricedLine[] = [];
  const { c } = certificationFactor(config.certified);

  if (config.metric === 'resources') {
    issues.push({
      code: 'pam_rl_needs_rule',
      message: 'Автоматический расчёт PAM RL в демо-адаптере не реализован (ошибки тарифной таблицы в источнике)',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
    results.push({
      line: buildLine({
        id: `${config.id}-base`,
        configurationId: config.id,
        itemId: 'PAM.RL',
        description: lineDesc('PAM.RL', 'Indeed PAM по ресурсам', config.quantity, 'resources', option.licenseType, option.termMonths, config.certified),
        calculatorQuantity: config.quantity,
        packageCapacity: null,
        saleQuantity: 1,
        saleUnit: 'package',
        unitPrice: null,
        lineTotal: null,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues,
    });
    return results;
  }

  if (option.licenseType === 'subscription' && option.termMonths !== 12 && option.termMonths != null) {
    issues.push({
      code: 'term_needs_rule',
      message: `Срок ${option.termMonths} мес. сохранён, но демо-правило расчёта есть только для 12 месяцев`,
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  if (config.metric === 'users' && config.quantity < 5) {
    issues.push({
      code: 'pam_min_users',
      message: 'PAM UL: минимум 5 пользователей',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }
  if (config.metric === 'concurrent_sessions' && config.quantity < 5) {
    issues.push({
      code: 'pam_min_cs',
      message: 'PAM CS: минимум 5 одновременных сессий',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }
  if (config.metric === 'users' && config.quantity < 10 && option.licenseType === 'perpetual') {
    issues.push({
      code: 'pam_ul_perpetual_min',
      message: 'PAM менее 10 пользователей — только подписка',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  const tiers: Tier[] = config.metric === 'concurrent_sessions' ? PAM_CS_TIERS : PAM_UL_TIERS;
  const itemId = config.metric === 'concurrent_sessions' ? 'PAM.CS' : 'PAM.UL';
  const U = averageUnitCost(config.quantity, tiers);

  let total: number | null = null;

  if (option.licenseType === 'perpetual' || option.termMonths === 12) {
    const priced = priceStandard(U, option.licenseType, c, terms.signedDiscount, config.quantity);
    total = priced.total;
  }

  results.push({
    line: buildLine({
      id: `${config.id}-base`,
      configurationId: config.id,
      itemId,
      description: lineDesc(itemId, itemId === 'PAM.CS' ? 'Indeed PAM по одновременным подключениям' : 'Indeed PAM по пользователям', config.quantity, config.metric, option.licenseType, option.termMonths, config.certified),
      calculatorQuantity: config.quantity,
      packageCapacity: config.quantity,
      saleQuantity: 1,
      saleUnit: 'package',
      unitPrice: total,
      lineTotal: total,
      tax: EXEMPT_TAX,
      licenseType: option.licenseType,
      termMonths: option.termMonths,
      certified: config.certified === true,
    }),
    issues,
  });

  // Kit
  if (config.kitQuantity > 0) {
    if (config.certified === false) {
      issues.push({
        code: 'kit_without_cert',
        message: 'Комплект ФСТЭК указан при обычной (не сертифицированной) версии',
        severity: 'error',
        blocksRelease: true,
        configurationId: config.id,
        optionId: option.id,
      });
    }
    const kitGross = FSTEC_KIT.gross * config.kitQuantity;
    const kitVat = FSTEC_KIT.vat * config.kitQuantity;
    results.push({
      line: buildLine({
        id: `${config.id}-kit`,
        configurationId: config.id,
        itemId: 'PAM.FSTEC_KIT',
        description: 'Сертифицированный ФСТЭК комплект Indeed Privileged Access Manager',
        calculatorQuantity: config.kitQuantity,
        packageCapacity: null,
        saleQuantity: config.kitQuantity,
        saleUnit: 'kit',
        unitPrice: FSTEC_KIT.gross,
        lineTotal: kitGross,
        tax: {
          mode: 'included',
          rate: FSTEC_KIT.vatRate,
          amount: toMoney(kitVat),
          basisSource: [{ sourceId: 'S05', locator: 'kit-vat' }],
        },
        licenseType: 'not_applicable',
        termMonths: null,
        certified: true,
      }),
      issues: [],
    });
  }

  // PAM modules needing rules
  for (const mod of config.modules) {
    issues.push({
      code: 'pam_module_needs_rule',
      message: `Модуль ${mod.itemId}: цена требует уточнения (неполная спецификация упаковки/SKU в демо)`,
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
    results.push({
      line: buildLine({
        id: `${config.id}-${mod.itemId}`,
        configurationId: config.id,
        itemId: mod.itemId,
        description: mod.itemId,
        calculatorQuantity: mod.quantity,
        packageCapacity: null,
        saleQuantity: mod.quantity,
        saleUnit: 'license',
        unitPrice: null,
        lineTotal: null,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues: [],
    });
  }

  // Attach issues once (do not spread the same array reference twice)
  if (results[0]) results[0].issues = [...issues];
  return results;
}

const AM_MODULE_IDS = new Set([
  'AM.WINDOWS_LOGON',
  'AM.ESSO',
  'AM.NPS_RADIUS',
  'AM.FREERADIUS',
  'AM.IDP',
  'AM.IIS',
  'AM.MDP',
  'AM.RDP_LOGON',
  'AM.API',
  'AM.LDAP_PROXY',
  'AM.LINUX_LOGON',
  'AM.ADFS',
  'AM.BIOMETRICS',
]);

function priceAm(
  config: Configuration,
  option: ProposalOption,
  terms: CommercialTerms,
): PricedLine[] {
  const issues: ValidationIssue[] = [];
  const results: PricedLine[] = [];
  const { c, issue } = certificationFactor(config.certified === null ? false : config.certified);
  // AM certification not typically used; if null treat as ordinary for calc but warn if true
  const certC = config.certified === true ? 1.3 : 1;
  if (config.certified === true) {
    issues.push({
      code: 'am_cert_demo',
      message: 'Сертификация AM не подтверждена каталогом — расчёт с коэффициентом только как демо',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }
  void c;
  void issue;

  if (config.quantity < 100) {
    issues.push({
      code: 'am_min_users',
      message: 'AM: минимум 100 пользователей',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  if (option.licenseType === 'perpetual') {
    const U = averageUnitCost(config.quantity, AM_BASE_TIERS);
    const unit = unitPriceFromU(U, 'perpetual', certC);
    const after = applySignedDiscount(unit, terms.signedDiscount);
    const total = after * config.quantity;
    if (total > 5_000_000 && total < 7_000_000) {
      issues.push({
        code: 'am_perpetual_band',
        message: 'AM бессрочный 5–7 млн ₽: требуется особое основание (замечание, не одобрение)',
        severity: 'warning',
        blocksRelease: true,
        configurationId: config.id,
        optionId: option.id,
      });
    }
  }

  const canPrice =
    option.licenseType === 'perpetual' ||
    (option.licenseType === 'subscription' && option.termMonths === 12);

  const baseU = averageUnitCost(config.quantity, AM_BASE_TIERS);
  let baseTotal: number | null = null;
  let baseUnit: number | null = null;
  if (canPrice) {
    const p = priceStandard(baseU, option.licenseType, certC, terms.signedDiscount, config.quantity);
    baseUnit = p.unitAfter;
    baseTotal = p.total;
  } else {
    issues.push({
      code: 'am_term_needs_rule',
      message: 'Срок подписки AM отличается от 12 мес. — требуется правило',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  results.push({
    line: buildLine({
      id: `${config.id}-base`,
      configurationId: config.id,
      itemId: 'AM.BASE',
      description: lineDesc('AM.BASE', 'программу для ЭВМ Indeed Access Manager', config.quantity, 'users', option.licenseType, option.termMonths, config.certified),
      calculatorQuantity: config.quantity,
      packageCapacity: null,
      saleQuantity: config.quantity,
      saleUnit: 'license',
      unitPrice: baseUnit,
      lineTotal: baseTotal,
      tax: EXEMPT_TAX,
      licenseType: option.licenseType,
      termMonths: option.termMonths,
      certified: config.certified,
    }),
    issues,
  });

  for (const mod of config.modules) {
    // WL is always priced as LL (same module tariff); keep display id if already LINUX_LOGON.
    const pricedItemId = mod.itemId === 'AM.WINDOWS_LOGON' ? 'AM.LINUX_LOGON' : mod.itemId;
    if (!AM_MODULE_IDS.has(pricedItemId) && !AM_MODULE_IDS.has(mod.itemId)) continue;
    const qty = mod.quantity || config.quantity;
    const effectiveId = AM_MODULE_IDS.has(pricedItemId) ? pricedItemId : mod.itemId;

    if (effectiveId === 'AM.MDP' && option.licenseType === 'subscription') {
      issues.push({
        code: 'mdp_qty_ref',
        message: 'Годовая стоимость MDP в исходнике ссылается на количество RDP — требуется уточнение',
        severity: 'info',
        blocksRelease: false,
        configurationId: config.id,
        optionId: option.id,
      });
    }

    const tiers = effectiveId === 'AM.BIOMETRICS' ? AM_BASE_TIERS : AM_MODULE_TIERS;
    const U = averageUnitCost(qty, tiers);
    const mult = effectiveId === 'AM.ESSO' ? 2 : 1;
    let unit: number | null = null;
    let total: number | null = null;
    if (canPrice) {
      const p = priceStandard(U, option.licenseType, certC, terms.signedDiscount, qty, { multiplier: mult });
      unit = p.unitAfter;
      total = p.total;
    }
    const descName =
      mod.itemId === 'AM.WINDOWS_LOGON'
        ? 'модуль Linux Logon (WL считается как LL)'
        : effectiveId === 'AM.LINUX_LOGON'
          ? 'модуль Linux Logon для программы для ЭВМ Indeed Access Manager'
          : effectiveId;
    results.push({
      line: buildLine({
        id: `${config.id}-${mod.itemId}`,
        configurationId: config.id,
        itemId: effectiveId,
        description: lineDesc(effectiveId, descName, qty, 'users', option.licenseType, option.termMonths, config.certified),
        calculatorQuantity: qty,
        packageCapacity: null,
        saleQuantity: qty,
        saleUnit: 'license',
        unitPrice: unit,
        lineTotal: total,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues: [],
    });
  }

  if (results[0]) results[0].issues = issues;
  return results;
}

function priceCm(
  config: Configuration,
  option: ProposalOption,
  terms: CommercialTerms,
): PricedLine[] {
  const issues: ValidationIssue[] = [];
  const results: PricedLine[] = [];

  if (config.platform === 'multiplatform') {
    issues.push({
      code: 'cm_multi_needs_rule',
      message: 'CM Мультиплатформа: полный автоматический расчёт в демо-MVP не реализован',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
    results.push({
      line: buildLine({
        id: `${config.id}-base`,
        configurationId: config.id,
        itemId: 'CM.MULTIPLATFORM.BASE',
        description: 'Indeed Certificate Manager Мультиплатформа',
        calculatorQuantity: config.quantity,
        packageCapacity: null,
        saleQuantity: config.quantity,
        saleUnit: 'license',
        unitPrice: null,
        lineTotal: null,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues,
    });
    return results;
  }

  if (config.platform == null) {
    issues.push({
      code: 'cm_platform_required',
      message: 'Платформа CM не уточнена (Windows / Мультиплатформа)',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  if (config.quantity < 100) {
    issues.push({
      code: 'cm_min_users',
      message: 'CM: минимум 100 пользователей',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  const canPrice =
    option.licenseType === 'perpetual' ||
    (option.licenseType === 'subscription' && option.termMonths === 12);
  const certC = config.certified === true ? 1.3 : 1;

  const baseU = averageUnitCost(config.quantity, CM_WINDOWS_BASE_TIERS);
  let baseUnit: number | null = null;
  let baseTotal: number | null = null;
  if (canPrice && config.platform === 'windows') {
    const p = priceStandard(baseU, option.licenseType, certC, terms.signedDiscount, config.quantity);
    baseUnit = p.unitAfter;
    baseTotal = p.total;
  }

  results.push({
    line: buildLine({
      id: `${config.id}-base`,
      configurationId: config.id,
      itemId: 'CM.WINDOWS.BASE',
      description: lineDesc('CM.WINDOWS.BASE', 'программу для ЭВМ Indeed Certificate Manager', config.quantity, 'users', option.licenseType, option.termMonths, config.certified),
      calculatorQuantity: config.quantity,
      packageCapacity: null,
      saleQuantity: config.quantity,
      saleUnit: 'license',
      unitPrice: baseUnit,
      lineTotal: baseTotal,
      tax: EXEMPT_TAX,
      licenseType: option.licenseType,
      termMonths: option.termMonths,
      certified: config.certified,
    }),
    issues,
  });

  for (const mod of config.modules) {
    const qty = mod.quantity || config.quantity;
    const U = averageUnitCost(qty, CM_WINDOWS_MODULE_TIERS);
    let unit: number | null = null;
    let total: number | null = null;
    if (canPrice && config.platform === 'windows') {
      const p = priceStandard(U, option.licenseType, certC, terms.signedDiscount, qty);
      unit = p.unitAfter;
      total = p.total;
    }
    const itemId = mod.itemId.startsWith('CM.') ? mod.itemId : 'CM.WINDOWS.AGENT';
    results.push({
      line: buildLine({
        id: `${config.id}-${itemId}`,
        configurationId: config.id,
        itemId,
        description: lineDesc(itemId, itemId, qty, 'users', option.licenseType, option.termMonths, config.certified),
        calculatorQuantity: qty,
        packageCapacity: null,
        saleQuantity: qty,
        saleUnit: 'license',
        unitPrice: unit,
        lineTotal: total,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues: [],
    });
  }

  if (results[0]) results[0].issues = issues;
  return results;
}

function priceItdr(
  config: Configuration,
  option: ProposalOption,
  terms: CommercialTerms,
): PricedLine[] {
  const issues: ValidationIssue[] = [];
  const results: PricedLine[] = [];
  const hasMfa = config.modules.some((m) => m.itemId === 'ITDR.MFA');
  const hasMon = config.modules.some((m) => m.itemId === 'ITDR.MONITORING');

  // If no modules, treat as both from config being ITDR with modules empty - use quantity for both if present in modules only
  const modules = config.modules.length
    ? config.modules
    : [
        { id: 'mon', itemId: 'ITDR.MONITORING', metric: 'licensed_units' as const, quantity: config.quantity },
      ];

  if (hasMfa && !hasMon && !modules.some((m) => m.itemId === 'ITDR.MONITORING')) {
    issues.push({
      code: 'itdr_mfa_requires_monitoring',
      message: 'ITDR MFA требует Monitoring',
      severity: 'error',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  if (config.certified === true) {
    issues.push({
      code: 'itdr_cert_unconfirmed',
      message: 'Коммерческая поставка сертифицированного ITDR этими данными не подтверждена — расчёт только как демо',
      severity: 'warning',
      blocksRelease: true,
      configurationId: config.id,
      optionId: option.id,
    });
  }

  const c = config.certified === true ? 1.3 : 1;
  const canPrice =
    option.licenseType === 'perpetual' ||
    (option.licenseType === 'subscription' && option.termMonths === 12);

  // Prefer Monitoring before MFA in document order
  const ordered = [...modules].sort((a, b) => {
    if (a.itemId === 'ITDR.MONITORING') return -1;
    if (b.itemId === 'ITDR.MONITORING') return 1;
    return 0;
  });

  for (const mod of ordered) {
    const qty = mod.quantity || config.quantity;
    let tiers: Tier[];
    if (mod.itemId === 'ITDR.MFA') {
      tiers = option.licenseType === 'subscription' ? ITDR_MFA_ANNUAL : ITDR_MFA_PERPETUAL;
    } else {
      tiers = option.licenseType === 'subscription' ? ITDR_MONITORING_ANNUAL : ITDR_MONITORING_PERPETUAL;
    }
    const U = averageUnitCost(qty, tiers);
    let unit: number | null = null;
    let total: number | null = null;
    if (canPrice) {
      const unitBefore = unitPriceItdr(U, c);
      const unitAfter = applySignedDiscount(unitBefore, terms.signedDiscount);
      unit = unitAfter;
      total = unitAfter * qty;
    } else {
      issues.push({
        code: 'itdr_term_needs_rule',
        message: 'Срок ITDR отличается от поддерживаемого — требуется правило',
        severity: 'warning',
        blocksRelease: true,
        configurationId: config.id,
        optionId: option.id,
      });
    }
    results.push({
      line: buildLine({
        id: `${config.id}-${mod.itemId}`,
        configurationId: config.id,
        itemId: mod.itemId,
        description: lineDesc(mod.itemId, mod.itemId === 'ITDR.MFA' ? 'ПО Indeed ITDR MFA' : 'ПО Indeed ITDR Monitoring', qty, 'licensed_units', option.licenseType, option.termMonths, config.certified),
        calculatorQuantity: qty,
        packageCapacity: null,
        saleQuantity: qty,
        saleUnit: 'license',
        unitPrice: unit,
        lineTotal: total,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues: [],
    });
  }

  if (results[0]) results[0].issues = issues;
  else {
    results.push({
      line: buildLine({
        id: `${config.id}-empty`,
        configurationId: config.id,
        itemId: 'ITDR.MONITORING',
        description: 'Indeed ITDR',
        calculatorQuantity: config.quantity,
        packageCapacity: null,
        saleQuantity: config.quantity,
        saleUnit: 'license',
        unitPrice: null,
        lineTotal: null,
        tax: EXEMPT_TAX,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
        certified: config.certified,
      }),
      issues,
    });
  }
  return results;
}

function priceConfiguration(
  config: Configuration,
  option: ProposalOption,
): PricedLine[] {
  if (!config.enabled) return [];
  const terms = option.commercialTerms;
  switch (config.product) {
    case 'PAM':
      return pricePamBase(config, option, terms);
    case 'AM':
      return priceAm(config, option, terms);
    case 'CM':
      return priceCm(config, option, terms);
    case 'ITDR':
      return priceItdr(config, option, terms);
    default:
      return [];
  }
}

export function calculateOptionSync(
  option: ProposalOption,
  revision: number,
): CalculationResult {
  const fp = fingerprint(option);
  const allIssues: ValidationIssue[] = [];
  const items: QuoteLine[] = [];

  if (option.commercialTerms.supportExtraYears > 0) {
    allIssues.push({
      code: 'support_extra_needs_rule',
      message: `Дополнительные годы поддержки (${option.commercialTerms.supportExtraYears}): правило не реализовано в демо-адаптере`,
      severity: 'warning',
      blocksRelease: true,
      optionId: option.id,
    });
  }

  for (const config of option.configurations) {
    const priced = priceConfiguration(config, option);
    for (const p of priced) {
      items.push(p.line);
      allIssues.push(...p.issues);
    }
  }

  let knownSubtotal = 0;
  let exemptAmount = 0;
  let taxableGross = 0;
  let includedTax = 0;
  let hasUnknown = false;
  let hasKnown = false;

  for (const line of items) {
    if (line.lineTotal == null) {
      hasUnknown = true;
      continue;
    }
    hasKnown = true;
    const n = Number(line.lineTotal);
    knownSubtotal += n;
    if (line.tax.mode === 'exempt') exemptAmount += n;
    if (line.tax.mode === 'included') {
      taxableGross += n;
      includedTax += Number(line.tax.amount ?? 0);
    }
  }

  let status: CalculationResult['status'] = 'complete';
  if (allIssues.some((i) => i.code.includes('needs_rule'))) status = 'needs_rule';
  if (hasUnknown && hasKnown) status = 'partial';
  if (hasUnknown && !hasKnown) status = 'needs_rule';
  if (allIssues.some((i) => i.severity === 'error' && i.blocksRelease) && status === 'complete') {
    status = 'partial';
  }

  const amount: Money | null = hasUnknown ? null : toMoney(knownSubtotal);
  const uniqueIssues = dedupeIssues(allIssues);

  return {
    optionId: option.id,
    revision,
    inputFingerprint: fp,
    mode: 'demo',
    status,
    items,
    totals: {
      amount,
      knownSubtotal: toMoney(knownSubtotal),
      exemptAmount: toMoney(exemptAmount),
      taxableGrossAmount: toMoney(taxableGross),
      includedTaxAmount: includedTax > 0 ? toMoney(includedTax) : taxableGross > 0 ? toMoney(includedTax) : null,
    },
    issues: uniqueIssues,
    provenance: {
      calculatorVersion: CALCULATOR_PROVENANCE.calculatorVersion,
      engineVersion: CALCULATOR_PROVENANCE.engineVersion,
      sourceHash: CALCULATOR_PROVENANCE.sourceHash,
    },
  };
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const out: ValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}|${issue.configurationId ?? ''}|${issue.optionId ?? ''}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

