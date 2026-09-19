/**
 * Independent audit harness — NOT product code.
 * Uses product modules only as black-box SUT; expected values computed separately.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.AUDIT_OUT || '/workspace/indeed-proposal-builder/audit/2026-09-19T1746Z';
mkdirSync(join(OUT, 'logs'), { recursive: true });
mkdirSync(join(OUT, 'exports'), { recursive: true });

const lines: string[] = [];
function log(msg: string) {
  lines.push(msg);
  console.log(msg);
}

// --- Independent pricing oracle (NOT imported from app helpers for expected) ---
type Tier = { from: number; rate: number };
const UL: Tier[] = [
  { from: 0, rate: 218160 },
  { from: 30, rate: 198720 },
  { from: 60, rate: 136080 },
  { from: 180, rate: 125280 },
  { from: 240, rate: 103680 },
  { from: 600, rate: 95040 },
];
const CS: Tier[] = [
  { from: 0, rate: 654480 },
  { from: 10, rate: 591840 },
  { from: 20, rate: 408240 },
  { from: 60, rate: 373680 },
  { from: 80, rate: 291600 },
  { from: 200, rate: 237600 },
];

function T(q: number, tiers: Tier[]): number {
  let total = 0;
  for (let i = 0; i < tiers.length; i++) {
    const from = tiers[i].from;
    const next = i + 1 < tiers.length ? tiers[i + 1].from : Infinity;
    const count = Math.max(0, Math.min(q, next) - from);
    total += count * tiers[i].rate;
    if (q <= next) break;
  }
  return total;
}

function annualLicenses(q: number, tiers: Tier[], c: number): number {
  const U = T(q, tiers) / q;
  const unit = Math.ceil(U * 0.533 * c - 1e-10);
  return unit * q;
}

function perpetualLicenses(q: number, tiers: Tier[], c: number): number {
  const U = T(q, tiers) / q;
  const unit = Math.ceil(U) * c;
  return unit * q;
}

log('=== Independent oracle vs control table ===');
const controls: Array<{
  name: string;
  expectedLic: number;
  expectedKit: number;
  expectedTotal: number;
  actualLic: number;
}> = [
  {
    name: 'PAM UL 25 year FSTEC',
    expectedLic: 3779100,
    expectedKit: 3050,
    expectedTotal: 3782150,
    actualLic: annualLicenses(25, UL, 1.3),
  },
  {
    name: 'PAM UL 25 perp FSTEC',
    expectedLic: 7090200,
    expectedKit: 3050,
    expectedTotal: 7093250,
    actualLic: perpetualLicenses(25, UL, 1.3),
  },
  {
    name: 'PAM UL 46 year ordinary',
    expectedLic: 5183096,
    expectedKit: 0,
    expectedTotal: 5183096,
    actualLic: annualLicenses(46, UL, 1),
  },
  {
    name: 'PAM UL 46 year FSTEC',
    expectedLic: 6737988,
    expectedKit: 3050,
    expectedTotal: 6741038,
    actualLic: annualLicenses(46, UL, 1.3),
  },
  {
    name: 'PAM UL 77 year ordinary',
    expectedLic: 7898968,
    expectedKit: 0,
    expectedTotal: 7898968,
    actualLic: annualLicenses(77, UL, 1),
  },
  {
    name: 'PAM UL 77 year FSTEC',
    expectedLic: 10268643,
    expectedKit: 3050,
    expectedTotal: 10271693,
    actualLic: annualLicenses(77, UL, 1.3),
  },
  {
    name: 'PAM UL 60 year ordinary',
    expectedLic: 6665940,
    expectedKit: 0,
    expectedTotal: 6665940,
    actualLic: annualLicenses(60, UL, 1),
  },
  {
    name: 'PAM CS 10 year ordinary',
    expectedLic: 3488380,
    expectedKit: 0,
    expectedTotal: 3488380,
    actualLic: annualLicenses(10, CS, 1),
  },
  {
    name: 'PAM CS 10 perp ordinary',
    expectedLic: 6544800,
    expectedKit: 0,
    expectedTotal: 6544800,
    actualLic: perpetualLicenses(10, CS, 1),
  },
];

for (const c of controls) {
  const ok = c.actualLic === c.expectedLic;
  log(`${ok ? 'OK' : 'FAIL'} oracle ${c.name}: got ${c.actualLic} expected ${c.expectedLic}`);
}

// Import SUT
const { calculateOptionSync } = await import('../../src/domain/calculateOption.ts');
const { normalizeRequest } = await import('../../src/domain/normalizeRequest.ts');
const { defaultCommercialTerms } = await import('../../src/data/demoProposal.ts');
const { buildProposalDocument } = await import('../../src/domain/buildProposalDocument.ts');
const { createDemoProposal, createEmptyProposal } = await import('../../src/data/demoProposal.ts');
const { createDocxExporter } = await import('../../src/services/docxExporter.ts');
const { exportService } = await import('../../src/services/pdfExporter.ts');
const { resolveSkuSync } = await import('../../src/services/catalogService.ts');

import type { Configuration, ProposalOption } from '../../src/domain/types.ts';

function pamOpt(
  q: number,
  lt: 'subscription' | 'perpetual',
  certified: boolean | null,
  kit: number,
  metric: Configuration['metric'] = 'users',
  discount = 0,
): ProposalOption {
  return {
    id: 'opt',
    label: lt,
    licenseType: lt,
    termMonths: lt === 'subscription' ? 12 : null,
    commercialTerms: { ...defaultCommercialTerms(), signedDiscount: discount },
    configurations: [
      {
        id: 'cfg',
        product: 'PAM',
        platform: null,
        metric,
        quantity: q,
        certified,
        kitQuantity: kit,
        modules: [],
        enabled: true,
      },
    ],
    calculation: null,
  };
}

log('\n=== SUT calculator vs control table ===');
const sutCases: Array<{
  name: string;
  opt: ProposalOption;
  lic: number;
  kit: number;
  total: number;
}> = [
  { name: 'PAM UL 25 year FSTEC', opt: pamOpt(25, 'subscription', true, 1), lic: 3779100, kit: 3050, total: 3782150 },
  { name: 'PAM UL 25 perp FSTEC', opt: pamOpt(25, 'perpetual', true, 1), lic: 7090200, kit: 3050, total: 7093250 },
  { name: 'PAM UL 46 year ordinary', opt: pamOpt(46, 'subscription', false, 0), lic: 5183096, kit: 0, total: 5183096 },
  { name: 'PAM UL 46 year FSTEC', opt: pamOpt(46, 'subscription', true, 1), lic: 6737988, kit: 3050, total: 6741038 },
  { name: 'PAM UL 77 year ordinary', opt: pamOpt(77, 'subscription', false, 0), lic: 7898968, kit: 0, total: 7898968 },
  { name: 'PAM UL 77 year FSTEC', opt: pamOpt(77, 'subscription', true, 1), lic: 10268643, kit: 3050, total: 10271693 },
  { name: 'PAM UL 60 year ordinary', opt: pamOpt(60, 'subscription', false, 0), lic: 6665940, kit: 0, total: 6665940 },
  { name: 'PAM CS 10 year ordinary', opt: pamOpt(10, 'subscription', false, 0, 'concurrent_sessions'), lic: 3488380, kit: 0, total: 3488380 },
  { name: 'PAM CS 10 perp ordinary', opt: pamOpt(10, 'perpetual', false, 0, 'concurrent_sessions'), lic: 6544800, kit: 0, total: 6544800 },
];

for (const c of sutCases) {
  const r = calculateOptionSync(c.opt, 1);
  const base = r.items.find((i) => i.itemId === 'PAM.UL' || i.itemId === 'PAM.CS');
  const kit = r.items.find((i) => i.itemId === 'PAM.FSTEC_KIT');
  const licOk = Number(base?.lineTotal) === c.lic;
  const kitOk = Number(kit?.lineTotal ?? 0) === c.kit;
  const totOk = Number(r.totals.amount) === c.total;
  const saleOk = base?.saleQuantity === 1 && base?.packageCapacity === c.opt.configurations[0].quantity;
  log(
    `${licOk && kitOk && totOk && saleOk ? 'OK' : 'FAIL'} SUT ${c.name}: lic=${base?.lineTotal} kit=${kit?.lineTotal ?? 0} total=${r.totals.amount} saleQty=${base?.saleQuantity} pkg=${base?.packageCapacity} sku=${base?.sku}`,
  );
}

// Boundaries
log('\n=== Boundaries UL 29/30/31 59/60/61 CS 9/10/11 ===');
for (const q of [29, 30, 31, 59, 60, 61]) {
  const sut = Number(calculateOptionSync(pamOpt(q, 'subscription', false, 0), 1).items[0].lineTotal);
  const oracle = annualLicenses(q, UL, 1);
  log(`${sut === oracle ? 'OK' : 'FAIL'} UL${q}: sut=${sut} oracle=${oracle}`);
}
for (const q of [9, 10, 11]) {
  const sut = Number(
    calculateOptionSync(pamOpt(q, 'subscription', false, 0, 'concurrent_sessions'), 1).items[0].lineTotal,
  );
  const oracle = annualLicenses(q, CS, 1);
  log(`${sut === oracle ? 'OK' : 'FAIL'} CS${q}: sut=${sut} oracle=${oracle}`);
}

// certified=null
log('\n=== certified=null ===');
{
  const r = calculateOptionSync(pamOpt(25, 'subscription', null, 0), 1);
  log(`status=${r.status} amount=${r.totals.amount} issues=${r.issues.map((i) => i.code).join(',')}`);
  log(`lineTotal=${r.items[0]?.lineTotal}`);
}

// kit 2, discount not on kit
log('\n=== kit 2 + discount 15% ===');
{
  const r = calculateOptionSync(pamOpt(25, 'subscription', true, 2, 'users', 0.15), 1);
  const kit = r.items.find((i) => i.itemId === 'PAM.FSTEC_KIT');
  const lic = r.items.find((i) => i.itemId === 'PAM.UL');
  log(`lic=${lic?.lineTotal} kit=${kit?.lineTotal} vat=${kit?.tax.amount} total=${r.totals.amount}`);
  log(`kit_expected_6100=${Number(kit?.lineTotal) === 6100} vat_expected_1100=${Number(kit?.tax.amount) === 1100}`);
}

// ordinary + kit 1 inconsistency
log('\n=== ordinary + kit1 ===');
{
  const r = calculateOptionSync(pamOpt(25, 'subscription', false, 1), 1);
  log(`issues=${r.issues.map((i) => i.code).join(',')}`);
}

// term 6 months
log('\n=== term 6 months ===');
{
  const opt = pamOpt(25, 'subscription', false, 0);
  opt.termMonths = 6;
  const r = calculateOptionSync(opt, 1);
  log(`status=${r.status} amount=${r.totals.amount} issues=${r.issues.map((i) => i.code).join(',')}`);
}

// SKU lookup
log('\n=== SKU lookups ===');
const skuChecks = [
  { itemId: 'PAM.UL', licenseType: 'subscription' as const, termMonths: 12, packageCapacity: 60, certified: false as boolean | null },
  { itemId: 'PAM.UL', licenseType: 'subscription' as const, termMonths: 12, packageCapacity: 46, certified: false as boolean | null },
  { itemId: 'PAM.UL', licenseType: 'subscription' as const, termMonths: 12, packageCapacity: 25, certified: true as boolean | null },
  { itemId: 'PAM.CS', licenseType: 'subscription' as const, termMonths: 12, packageCapacity: 10, certified: false as boolean | null },
  { itemId: 'PAM.FSTEC_KIT', licenseType: 'not_applicable' as const, termMonths: null, packageCapacity: null, certified: true as boolean | null },
];
for (const s of skuChecks) {
  const r = resolveSkuSync(s);
  log(`SKU ${s.itemId} q=${s.packageCapacity} cert=${s.certified} -> ${r.sku} (${r.status})`);
}

// Parser battery
log('\n=== Parser battery ===');
const queries = [
  'PAM25 FSTEC',
  'PAM 46 FSTEC',
  'PAM ФСТЭК на 77 пользователей',
  'PAM 10 CS',
  'PAM 46 без ФСТЭК',
  'PAM 46 не ФСТЭК',
  'PAM 46 обычная версия',
  'PAM 46 77',
  'PAM на 46 пользователей на 12 месяцев',
  'PAM на 46 пользователей на 6 месяцев',
  'AM WL LDAP 437',
  'AM WL RDP LDAP SSO 150',
  'AM NPS RADIUS 150',
  'AM FreeRADIUS 150',
  'CM agent 350',
  'ITDR Monitoring MFA 300',
  'AAPM 50',
  'PAM 46 неизвестнаяОпция',
];
for (const q of queries) {
  const r = normalizeRequest(q);
  const p = r.products[0];
  log(
    `PARSE "${q}" => product=${p?.product} qty=${p?.quantity} metric=${p?.metric} cert=${p?.certified} kit=${p?.kitQuantity} modules=${p?.modules?.map((m) => m.itemId).join('|') ?? ''} term=${r.termMonths} conflicts=${r.conflicts.length} unk=${r.unrecognized.join('|')} q=${r.questions.slice(0, 2).join(';')}`,
  );
}

// ITDR / CM fixtures via SUT
log('\n=== ITDR / CM fixtures ===');
{
  const itdr = (lt: 'subscription' | 'perpetual'): ProposalOption => ({
    id: 'o',
    label: lt,
    licenseType: lt,
    termMonths: lt === 'subscription' ? 12 : null,
    commercialTerms: defaultCommercialTerms(),
    configurations: [
      {
        id: 'c',
        product: 'ITDR',
        platform: null,
        metric: 'licensed_units',
        quantity: 300,
        certified: false,
        kitQuantity: 0,
        enabled: true,
        modules: [
          { id: 'm1', itemId: 'ITDR.MONITORING', metric: 'licensed_units', quantity: 300 },
          { id: 'm2', itemId: 'ITDR.MFA', metric: 'licensed_units', quantity: 300 },
        ],
      },
    ],
    calculation: null,
  });
  const a = calculateOptionSync(itdr('subscription'), 1);
  const b = calculateOptionSync(itdr('perpetual'), 1);
  log(`ITDR annual total=${a.totals.amount} expected=2970600.00 match=${a.totals.amount === '2970600.00'}`);
  log(`ITDR perp total=${b.totals.amount} expected=5572500.00 match=${b.totals.amount === '5572500.00'}`);
}
{
  const cm = (lt: 'subscription' | 'perpetual'): ProposalOption => ({
    id: 'o',
    label: lt,
    licenseType: lt,
    termMonths: lt === 'subscription' ? 12 : null,
    commercialTerms: { ...defaultCommercialTerms(), signedDiscount: -0.15 },
    configurations: [
      {
        id: 'c',
        product: 'CM',
        platform: 'windows',
        metric: 'users',
        quantity: 350,
        certified: false,
        kitQuantity: 0,
        enabled: true,
        modules: [{ id: 'm', itemId: 'CM.WINDOWS.AGENT', metric: 'users', quantity: 350 }],
      },
    ],
    calculation: null,
  });
  const a = calculateOptionSync(cm('subscription'), 1);
  const b = calculateOptionSync(cm('perpetual'), 1);
  log(`CM annual total=${a.totals.amount} expected=793327.50 match=${a.totals.amount === '793327.50'}`);
  log(`CM perp total=${b.totals.amount} expected=1487640.00 match=${b.totals.amount === '1487640.00'}`);
}

// Alternative independence
log('\n=== Demo proposal independence ===');
{
  const demo = createDemoProposal();
  const a = demo.options[0].configurations[0];
  const b = demo.options[1].configurations[0];
  log(`ids_differ=${a.id !== b.id}`);
  a.quantity = 999;
  log(`copy_independent=${b.quantity === 25}`);
  log(`sub_total=${demo.options[0].calculation?.totals.amount}`);
  log(`perp_total=${demo.options[1].calculation?.totals.amount}`);
}

// Empty proposal
log('\n=== Empty / new proposal ===');
{
  const empty = createEmptyProposal();
  log(`customer="${empty.customer.legalName}" number="${empty.number}" configs0=${empty.options[0].configurations.length}`);
}

// Document + export PAM46 FSTEC both alts
log('\n=== Document + DOCX/PDF exports ===');
{
  const demo = createDemoProposal();
  // rewrite to PAM46 FSTEC
  for (const opt of demo.options) {
    for (const c of opt.configurations) {
      c.quantity = 46;
      c.certified = true;
      c.kitQuantity = 1;
    }
    opt.calculation = calculateOptionSync(opt, 2);
  }
  demo.customer.legalName = 'ООО Тест аудита';
  demo.number = 'КП-AUDIT-001';
  const doc = buildProposalDocument(demo);
  const hasBrace = JSON.stringify(doc).includes('{{');
  const hasEllipsis = doc.blocks.some((b) => b.type === 'paragraph' && b.text === '...');
  log(`blocks=${doc.blocks.length} unresolved=${doc.unresolvedNotes.length} braces=${hasBrace} ellipsis=${hasEllipsis}`);
  log(`unresolved_sample=${doc.unresolvedNotes.slice(0, 5).join(' | ')}`);
  log(`demoBanner=${doc.blocks.some((b) => b.type === 'demoBanner')}`);
  log(`tables=${doc.blocks.filter((b) => b.type === 'table').length}`);

  const docx = await createDocxExporter().toDocx(doc);
  const docxBuf = Buffer.from(await docx.arrayBuffer());
  writeFileSync(join(OUT, 'exports', 'audit-pam46-fstec.docx'), docxBuf);
  log(`docx_bytes=${docxBuf.length} isZip=${docxBuf[0] === 0x50 && docxBuf[1] === 0x4b}`);

  try {
    const pdf = await exportService.toPdf(doc);
    const pdfBuf = Buffer.from(await pdf.arrayBuffer());
    writeFileSync(join(OUT, 'exports', 'audit-pam46-fstec.pdf'), pdfBuf);
    log(`pdf_bytes=${pdfBuf.length} isPDF=${pdfBuf.slice(0, 4).toString() === '%PDF'}`);
  } catch (e) {
    log(`pdf_error=${e instanceof Error ? e.message : String(e)}`);
  }
}

// Multi-product long doc
{
  const opt: ProposalOption = {
    id: 'o1',
    label: 'Подписка 12 месяцев',
    licenseType: 'subscription',
    termMonths: 12,
    commercialTerms: defaultCommercialTerms(),
    configurations: [
      {
        id: 'pam',
        product: 'PAM',
        platform: null,
        metric: 'users',
        quantity: 60,
        certified: false,
        kitQuantity: 0,
        enabled: true,
        modules: [],
      },
      {
        id: 'am',
        product: 'AM',
        platform: null,
        metric: 'users',
        quantity: 150,
        certified: false,
        kitQuantity: 0,
        enabled: true,
        modules: [
          { id: 'm1', itemId: 'AM.WINDOWS_LOGON', metric: 'users', quantity: 150 },
          { id: 'm2', itemId: 'AM.LDAP_PROXY', metric: 'users', quantity: 150 },
          { id: 'm3', itemId: 'AM.ADFS', metric: 'users', quantity: 150 },
          { id: 'm4', itemId: 'AM.ESSO', metric: 'users', quantity: 150 },
        ],
      },
    ],
    calculation: null,
  };
  opt.calculation = calculateOptionSync(opt, 1);
  const proposal = {
    ...createEmptyProposal(),
    number: 'КП-AUDIT-MULTI',
    customer: { legalName: 'ООО Тест аудита' },
    options: [opt],
  };
  const doc = buildProposalDocument(proposal);
  const docx = await createDocxExporter().toDocx(doc);
  const buf = Buffer.from(await docx.arrayBuffer());
  writeFileSync(join(OUT, 'exports', 'audit-multi-product.docx'), buf);
  log(`multi_docx=${buf.length} unresolved=${doc.unresolvedNotes.length} wl_null=${opt.calculation.items.find((i) => i.itemId === 'AM.WINDOWS_LOGON')?.lineTotal === null}`);
  log(`multi_status=${opt.calculation.status} amount=${opt.calculation.totals.amount}`);
  try {
    const pdf = await exportService.toPdf(doc);
    const pdfBuf = Buffer.from(await pdf.arrayBuffer());
    writeFileSync(join(OUT, 'exports', 'audit-multi-product.pdf'), pdfBuf);
    log(`multi_pdf=${pdfBuf.length}`);
  } catch (e) {
    log(`multi_pdf_error=${e instanceof Error ? e.message : String(e)}`);
  }
}

// Incomplete draft export
{
  const opt = pamOpt(46, 'subscription', true, 1);
  const r = calculateOptionSync(opt, 1);
  const proposal = {
    ...createEmptyProposal(),
    number: 'КП-AUDIT-PARTIAL',
    customer: { legalName: 'ООО Тест аудита' },
    options: [{ ...opt, calculation: r }],
  };
  const doc = buildProposalDocument(proposal);
  const docx = await createDocxExporter().toDocx(doc);
  writeFileSync(join(OUT, 'exports', 'audit-partial-sku.docx'), Buffer.from(await docx.arrayBuffer()));
  log(`partial unresolved has sku note=${doc.unresolvedNotes.some((n) => /артикул|sku|не уточн/i.test(n))}`);
  log(`partial sku=${r.items[0].sku}`);
}

writeFileSync(join(OUT, 'logs', 'audit-harness.log'), lines.join('\n'));
log(`\nWrote ${join(OUT, 'logs', 'audit-harness.log')}`);
