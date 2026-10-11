/**
 * Local-only generation of one- and two-table DEMO DOCX under .local/out/.
 * Does not write into public/ or commit confidential customer names from samples.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateOptionSync } from '../src/domain/calculateOption.ts';
import { buildProposalDocument } from '../src/domain/buildProposalDocument.ts';
import { createDocxExporter } from '../src/services/docxExporter.ts';
import { DEMO_SUPPLIER } from '../src/data/demoSupplier.ts';
import type { Configuration, Proposal, ProposalOption } from '../src/domain/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.local', 'out');

function option(
  label: string,
  metric: 'users' | 'concurrent_sessions',
  quantity: number,
  licenseType: 'subscription' | 'perpetual',
): ProposalOption {
  const cfg: Configuration = {
    id: `cfg-${label}`,
    product: 'PAM',
    platform: null,
    metric,
    quantity,
    certified: false,
    kitQuantity: 0,
    modules: [],
    enabled: true,
  };
  const opt: ProposalOption = {
    id: `opt-${label}`,
    label,
    licenseType,
    termMonths: licenseType === 'subscription' ? 12 : null,
    commercialTerms: {
      signedDiscount: 0,
      supportSignedDiscount: 0,
      adjustmentReason: null,
      supportIncludedMonths: 12,
      supportExtraYears: 0,
      exceptions: [],
    },
    configurations: [cfg],
    calculation: null,
  };
  opt.calculation = calculateOptionSync(opt, 1);
  return opt;
}

function proposal(id: string, number: string, options: ProposalOption[]): Proposal {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    number,
    issueDate: '2026-10-11',
    rawRequest: 'control case',
    customer: { legalName: 'CONTROL CUSTOMER (DEMO)' },
    manager: { displayName: 'Demo Manager' },
    supplierProfileId: DEMO_SUPPLIER.id,
    currency: 'RUB',
    validity: { kind: 'calendar_months', months: 1 },
    options,
    status: 'draft',
    issues: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const exporter = createDocxExporter();

  const oneTable = proposal('ctrl-ul60', 'CTRL-UL60', [
    option('Годовая лицензия', 'users', 60, 'subscription'),
  ]);
  const twoTable = proposal('ctrl-cs10', 'CTRL-CS10', [
    option('Годовая лицензия', 'concurrent_sessions', 10, 'subscription'),
    option('Бессрочная лицензия', 'concurrent_sessions', 10, 'perpetual'),
  ]);

  for (const [name, p] of [
    ['one-table-ul60.docx', oneTable],
    ['two-table-cs10.docx', twoTable],
  ] as const) {
    const doc = buildProposalDocument(p);
    const blob = await exporter.toDocx(doc);
    const buf = Buffer.from(await blob.arrayBuffer());
    const path = join(outDir, name);
    await writeFile(path, buf);
    console.log('wrote', path, buf.length, 'bytes', 'tables~', p.options.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
