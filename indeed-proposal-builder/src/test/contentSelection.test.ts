import { describe, expect, it } from 'vitest';
import { calculateOptionSync } from '../domain/calculateOption';
import { buildProposalDocument } from '../domain/buildProposalDocument';
import { defaultCommercialTerms } from '../data/demoProposal';
import { DEMO_SUPPLIER } from '../data/demoSupplier';
import type { Proposal, ProposalOption } from '../domain/types';

function baseProposal(options: ProposalOption[]): Proposal {
  const now = new Date().toISOString();
  for (const o of options) o.calculation = calculateOptionSync(o, 1);
  return {
    schemaVersion: 1,
    id: 'p',
    number: 'T-1',
    issueDate: '2026-10-11',
    rawRequest: 'x',
    customer: { legalName: 'Cust', articleGroupId: 'standard' },
    manager: { displayName: 'M' },
    supplierProfileId: DEMO_SUPPLIER.id,
    currency: 'RUB',
    validity: { kind: 'days', days: 30 },
    options,
    status: 'draft',
    issues: [],
    createdAt: now,
    updatedAt: now,
  };
}

function textOf(doc: ReturnType<typeof buildProposalDocument>): string {
  return doc.blocks
    .map((b) => {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'note') return b.text;
      if (b.type === 'list') return b.items.join('\n');
      return '';
    })
    .join('\n');
}

describe('content selection from actual composition', () => {
  it('PAM CS includes CS text, not UL', () => {
    const opt: ProposalOption = {
      id: 'o',
      label: 'Годовая',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'PAM',
          platform: null,
          metric: 'concurrent_sessions',
          quantity: 25,
          certified: false,
          kitQuantity: 0,
          modules: [],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const text = textOf(buildProposalDocument(baseProposal([opt])));
    expect(text).toMatch(/concurrent sessions/i);
    expect(text).not.toMatch(/user license, UL/i);
    expect(text).not.toMatch(/ФСТЭК комплект/i);
  });

  it('AM Windows Logon does not emit Linux Logon module blurb', () => {
    const opt: ProposalOption = {
      id: 'o',
      label: 'Годовая',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'AM',
          platform: null,
          metric: 'users',
          quantity: 100,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm', itemId: 'AM.WINDOWS_LOGON', metric: 'users', quantity: 100 }],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const text = textOf(buildProposalDocument(baseProposal([opt])));
    expect(text).toMatch(/Windows Logon|windows logon/i);
    // Dedicated Linux Logon product description should not appear for WL-only selection
    expect(text).not.toMatch(/модуль Linux Logon для программы для ЭВМ Indeed Access Manager/);
  });

  it('ITDR Monitoring-only omits MFA promises', () => {
    const opt: ProposalOption = {
      id: 'o',
      label: 'Годовая',
      licenseType: 'subscription',
      termMonths: 12,
      commercialTerms: defaultCommercialTerms(),
      configurations: [
        {
          id: 'c',
          product: 'ITDR',
          platform: null,
          metric: 'licensed_units',
          quantity: 100,
          certified: false,
          kitQuantity: 0,
          modules: [{ id: 'm', itemId: 'ITDR.MONITORING', metric: 'licensed_units', quantity: 100 }],
          enabled: true,
        },
      ],
      calculation: null,
    };
    const text = textOf(buildProposalDocument(baseProposal([opt])));
    expect(text).toMatch(/Monitoring|мониторинг/i);
    expect(text).not.toMatch(/Лицензия Indeed ITDR MFA/);
  });
});
