import { describe, expect, it } from 'vitest';
import { normalizeRequest, candidateToConfiguration } from '../domain/normalizeRequest';
import { calculateOptionSync } from '../domain/calculateOption';
import { buildProposalDocument } from '../domain/buildProposalDocument';
import { defaultCommercialTerms, createEmptyProposal } from '../data/demoProposal';
import type { ProposalOption } from '../domain/types';

function optionFromQuery(query: string, licenseType: 'subscription' | 'perpetual', termMonths: number | null): ProposalOption {
  const cand = normalizeRequest(query);
  expect(cand.products.length).toBeGreaterThan(0);
  const cfg = candidateToConfiguration(cand.products[0], 'cfg-test');
  return {
    id: 'opt-test',
    label: licenseType === 'subscription' ? 'Подписка' : 'Бессрочная',
    licenseType,
    termMonths,
    commercialTerms: defaultCommercialTerms(),
    configurations: [cfg],
    calculation: null,
  };
}

describe('search → price → document integration', () => {
  it('PAM 25 ordinary: price, SKU, and document table row', () => {
    const opt = optionFromQuery('PAM 25', 'subscription', 12);
    expect(opt.configurations[0].certified).toBe(false);
    expect(opt.configurations[0].quantity).toBe(25);
    const calc = calculateOptionSync(opt, 1);
    expect(calc.items[0].sku).toBe('PAM-01120025');
    expect(Number(calc.totals.amount)).toBe(2907000);

    const proposal = createEmptyProposal();
    proposal.options = [{ ...opt, calculation: calc }];
    const doc = buildProposalDocument(proposal);
    const table = doc.blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table').toBe(true);
    if (table && table.type === 'table') {
      const skuCell = table.rows.some((r) => r.cells.includes('PAM-01120025'));
      expect(skuCell).toBe(true);
      expect(
        table.rows.some((r) =>
          r.cells.some((c) => /2[\s\u00a0]?907[\s\u00a0]?000/.test(c.replace(/\u00a0/g, ' '))),
        ),
      ).toBe(true);
    }
  });

  it('PAM 25 FSTEC with kit', () => {
    const opt = optionFromQuery('PAM 25 ФСТЭК', 'subscription', 12);
    expect(opt.configurations[0].certified).toBe(true);
    expect(opt.configurations[0].kitQuantity).toBe(1);
    const calc = calculateOptionSync(opt, 1);
    expect(calc.items[0].sku).toBe('PF-01120025');
    expect(Number(calc.totals.amount)).toBe(3782150);
  });

  it('finds products by full name aliases', () => {
    expect(normalizeRequest('Access Manager').products[0]?.product).toBe('AM');
    expect(normalizeRequest('Privileged Access Manager').products[0]?.product).toBe('PAM');
    expect(normalizeRequest('Certificate Manager').products[0]?.product).toBe('CM');
    expect(normalizeRequest('Windows Logon').products[0]?.product).toBe('AM');
    expect(normalizeRequest('ITDR Monitoring').products[0]?.product).toBe('ITDR');
  });

  it('PAM 46 keeps price without inventing SKU', () => {
    const opt = optionFromQuery('PAM 46', 'subscription', 12);
    const calc = calculateOptionSync(opt, 1);
    expect(Number(calc.totals.amount)).toBe(5183096);
    expect(calc.items[0].sku).toBeNull();
    expect(calc.items[0].skuStatus).toBe('unresolved');
  });

  it('AM 150 annual matches control total and SKU', () => {
    const opt = optionFromQuery('AM 150', 'subscription', 12);
    opt.configurations[0].quantity = 150;
    const calc = calculateOptionSync(opt, 1);
    expect(Number(calc.totals.amount)).toBe(256500);
    expect(calc.items[0].sku).toBe('AM-12000001');
  });
});
