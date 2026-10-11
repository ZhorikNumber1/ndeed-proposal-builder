/**
 * Generate DEMO DOCX control docs, convert DOCX→PDF→PNG pages,
 * and write a structural/visual comparison report vs kp2699 / kp2705.
 * Outputs under .local/out/visual/ (gitignored).
 */
import { mkdir, writeFile, copyFile, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { calculateOptionSync } from '../src/domain/calculateOption.ts';
import { buildProposalDocument } from '../src/domain/buildProposalDocument.ts';
import { createDocxExporter } from '../src/services/docxExporter.ts';
import { DEMO_SUPPLIER } from '../src/data/demoSupplier.ts';
import type { Configuration, Proposal, ProposalOption } from '../src/domain/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.local', 'out', 'visual');
const inputs = join(root, '.local', 'inputs');

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
    rawRequest: 'visual control',
    customer: { legalName: 'CONTROL CUSTOMER (DEMO)', articleGroupId: 'standard' },
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

async function writeDocx(name: string, p: Proposal): Promise<string> {
  const exporter = createDocxExporter();
  const doc = buildProposalDocument(p);
  const blob = await exporter.toDocx(doc);
  const buf = Buffer.from(await blob.arrayBuffer());
  const path = join(outDir, name);
  await writeFile(path, buf);
  return path;
}

function sofficeToPdf(docxPath: string, destDir: string): string {
  execFileSync(
    'soffice',
    ['--headless', '--nologo', '--nolockcheck', '--nodefault', '--convert-to', 'pdf', '--outdir', destDir, docxPath],
    { stdio: 'pipe', timeout: 180_000 },
  );
  const base = docxPath.split('/').pop()!.replace(/\.docx$/i, '.pdf');
  return join(destDir, base);
}

async function pdfToPng(pdfPath: string, prefix: string): Promise<string[]> {
  const outPrefix = join(outDir, prefix);
  execFileSync('pdftoppm', ['-png', '-r', '110', pdfPath, outPrefix], { stdio: 'pipe' });
  const files = await readdir(outDir);
  return files
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .sort()
    .map((f) => join(outDir, f));
}

function unzipList(docxPath: string): string {
  return execFileSync('unzip', ['-l', docxPath], { encoding: 'utf8' });
}

function unzipFile(docxPath: string, inner: string): Buffer {
  return execFileSync('unzip', ['-p', docxPath, inner]);
}

async function ooxmlSummary(docxPath: string) {
  const buf = await readFile(docxPath);
  const listing = unzipList(docxPath);
  const media = [...listing.matchAll(/word\/media\/\S+/g)].map((m) => m[0]);
  const docXml = unzipFile(docxPath, 'word/document.xml').toString('utf8');
  let header = '';
  for (const h of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml']) {
    try {
      header = unzipFile(docxPath, h).toString('utf8');
      break;
    } catch {
      /* try next */
    }
  }
  const tables = (docXml.match(/<w:tbl[\s>]/g) || []).length;
  const hasBaranov = /Баранов/.test(docXml);
  const hasRole = /Управляющий управляющей организации/.test(docXml);
  const hasDemo = /DEMO|демо/i.test(docXml);
  const mediaHashes: Record<string, string> = {};
  for (const m of media) {
    try {
      mediaHashes[m] = createHash('sha256').update(unzipFile(docxPath, m)).digest('hex').slice(0, 16);
    } catch {
      /* skip */
    }
  }
  return {
    tables,
    hasBaranov,
    hasRole,
    hasDemo,
    hasHeader: header.length > 0,
    media,
    mediaHashes,
    bytes: buf.length,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const one = proposal('v-ul60', 'VIS-UL60', [option('Годовая лицензия', 'users', 60, 'subscription')]);
  const two = proposal('v-cs10', 'VIS-CS10', [
    option('Годовая лицензия', 'concurrent_sessions', 10, 'subscription'),
    option('Бессрочная лицензия', 'concurrent_sessions', 10, 'perpetual'),
  ]);

  const genOne = await writeDocx('generated-one-table-ul60.docx', one);
  const genTwo = await writeDocx('generated-two-table-cs10.docx', two);

  await copyFile(join(inputs, 'kp2699-KSK-IT-pam60-MN-sep2026.docx'), join(outDir, 'ref-kp2699.docx'));
  await copyFile(join(inputs, 'kp2705-Oilgaztet-pam10cs-TT-sep2026.docx'), join(outDir, 'ref-kp2705.docx'));

  const docs = [
    { key: 'gen-ul60', path: genOne, refKey: 'ref-kp2699', refPath: join(outDir, 'ref-kp2699.docx') },
    { key: 'gen-cs10', path: genTwo, refKey: 'ref-kp2705', refPath: join(outDir, 'ref-kp2705.docx') },
  ];

  const report: string[] = [
    '# Visual / structural DOCX comparison',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Method: LibreOffice headless DOCX→PDF, pdftoppm PNG @110dpi',
    'DEMO status retained on generated docs.',
    '',
  ];

  for (const d of docs) {
    report.push(`## ${d.key} vs ${d.refKey}`);
    const genSum = await ooxmlSummary(d.path);
    const refSum = await ooxmlSummary(d.refPath);
    report.push('');
    report.push('| Check | Generated | Reference |');
    report.push('|---|---|---|');
    report.push(`| bytes | ${genSum.bytes} | ${refSum.bytes} |`);
    report.push(`| body tables | ${genSum.tables} | ${refSum.tables} |`);
    report.push(`| header present | ${genSum.hasHeader} | ${refSum.hasHeader} |`);
    report.push(`| Баранов | ${genSum.hasBaranov} | ${refSum.hasBaranov} |`);
    report.push(`| должность Управляющий… | ${genSum.hasRole} | ${refSum.hasRole} |`);
    report.push(`| DEMO marker | ${genSum.hasDemo} | ${refSum.hasDemo} |`);
    report.push(`| media files | ${genSum.media.length} | ${refSum.media.length} |`);

    const genHashes = new Set(Object.values(genSum.mediaHashes));
    const refHashes = new Set(Object.values(refSum.mediaHashes));
    const hashMatch = [...refHashes].filter((h) => genHashes.has(h));
    report.push(`| shared media SHA-16 | ${hashMatch.length}/${refHashes.size} | — |`);

    try {
      const genPdf = sofficeToPdf(d.path, outDir);
      const refPdf = sofficeToPdf(d.refPath, outDir);
      const genPages = await pdfToPng(genPdf, `${d.key}-p`);
      const refPages = await pdfToPng(refPdf, `${d.refKey}-p`);
      report.push(`| PDF pages | ${genPages.length} | ${refPages.length} |`);
      report.push('');
      report.push('Page images:');
      for (const p of genPages) report.push(`- gen: \`${p.split('/').pop()}\``);
      for (const p of refPages) report.push(`- ref: \`${p.split('/').pop()}\``);
    } catch (e) {
      report.push(`| render | ERROR: ${(e as Error).message.slice(0, 200)} | |`);
    }
    report.push('');
  }

  report.push('## Visual notes');
  report.push('- Compare page-1 PNGs for logo / requisites / red line alignment.');
  report.push('- Last page: signature + stamp must not clip; generated keeps DEMO banner.');
  report.push('- Frontend pdfmake PDF is approximate; these PNGs are from LibreOffice DOCX→PDF.');
  report.push('- Customer names/numbers from references must not be copied into defaults.');
  report.push('');

  const reportPath = join(outDir, 'COMPARE_REPORT.md');
  await writeFile(reportPath, report.join('\n'));
  console.log(report.join('\n'));
  console.log('Wrote', reportPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
