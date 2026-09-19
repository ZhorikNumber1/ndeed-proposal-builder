import type { CommercialTerms, Configuration, Proposal, ProposalOption } from '../domain/types';
import { todayDateOnly } from '../domain/dates';
import { calculateOptionSync } from '../domain/calculateOption';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultCommercialTerms(): CommercialTerms {
  return {
    signedDiscount: 0,
    supportSignedDiscount: 0,
    adjustmentReason: null,
    supportIncludedMonths: 12,
    supportExtraYears: 0,
    exceptions: [],
  };
}

export function cloneConfigurations(configs: Configuration[]): Configuration[] {
  return configs.map((c) => ({
    ...c,
    id: uid('cfg'),
    modules: c.modules.map((m) => ({ ...m, id: uid('mod') })),
  }));
}

function pamDemoConfig(id: string): Configuration {
  return {
    id,
    product: 'PAM',
    platform: null,
    metric: 'users',
    quantity: 25,
    certified: true,
    kitQuantity: 1,
    modules: [],
    enabled: true,
  };
}

export function createDemoProposal(): Proposal {
  const cfgSub = pamDemoConfig(uid('cfg'));
  const cfgPerp = pamDemoConfig(uid('cfg'));

  const subOption: ProposalOption = {
    id: uid('opt'),
    label: 'Подписка 12 месяцев',
    licenseType: 'subscription',
    termMonths: 12,
    commercialTerms: defaultCommercialTerms(),
    configurations: [cfgSub],
    calculation: null,
  };

  const perpOption: ProposalOption = {
    id: uid('opt'),
    label: 'Бессрочная',
    licenseType: 'perpetual',
    termMonths: null,
    commercialTerms: defaultCommercialTerms(),
    configurations: [cfgPerp],
    calculation: null,
  };

  subOption.calculation = calculateOptionSync(subOption, 1);
  perpOption.calculation = calculateOptionSync(perpOption, 1);

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: uid('prop'),
    number: 'КП-2026-0123',
    issueDate: '2026-05-07',
    rawRequest: 'PAM25 FSTEC',
    customer: { legalName: 'ООО «Ромашка»' },
    manager: { displayName: 'Иванов И.И.' },
    supplierProfileId: 'indeed-supplier-demo',
    currency: 'RUB',
    validity: { kind: 'days', days: 30 },
    options: [subOption, perpOption],
    status: 'draft',
    issues: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyProposal(): Proposal {
  const now = new Date().toISOString();
  const cfg = pamDemoConfig(uid('cfg'));
  cfg.quantity = 0;
  cfg.certified = null;
  cfg.kitQuantity = 0;
  cfg.enabled = true;

  const sub: ProposalOption = {
    id: uid('opt'),
    label: 'Подписка 12 месяцев',
    licenseType: 'subscription',
    termMonths: 12,
    commercialTerms: defaultCommercialTerms(),
    configurations: [],
    calculation: null,
  };
  const perp: ProposalOption = {
    id: uid('opt'),
    label: 'Бессрочная',
    licenseType: 'perpetual',
    termMonths: null,
    commercialTerms: defaultCommercialTerms(),
    configurations: [],
    calculation: null,
  };

  return {
    schemaVersion: 1,
    id: uid('prop'),
    number: '',
    issueDate: todayDateOnly(),
    rawRequest: '',
    customer: { legalName: '' },
    manager: { displayName: '' },
    supplierProfileId: 'indeed-supplier-demo',
    currency: 'RUB',
    validity: { kind: 'days', days: 30 },
    options: [sub, perp],
    status: 'draft',
    issues: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newConfiguration(product: Configuration['product']): Configuration {
  return {
    id: uid('cfg'),
    product,
    platform: product === 'CM' ? 'windows' : null,
    metric: product === 'PAM' ? 'users' : product === 'ITDR' ? 'licensed_units' : 'users',
    quantity: product === 'AM' || product === 'CM' ? 100 : product === 'PAM' ? 5 : 1,
    certified: null,
    kitQuantity: 0,
    modules:
      product === 'ITDR'
        ? [
            {
              id: uid('mod'),
              itemId: 'ITDR.MONITORING',
              metric: 'licensed_units',
              quantity: 1,
            },
          ]
        : [],
    enabled: true,
  };
}

export function duplicateConfiguration(config: Configuration): Configuration {
  return {
    ...config,
    id: uid('cfg'),
    modules: config.modules.map((m) => ({ ...m, id: uid('mod') })),
  };
}
