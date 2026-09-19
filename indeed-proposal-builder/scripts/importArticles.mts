import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import type {
  ArticleEntry,
  ArticleEntryKind,
  ArticleEntryQuality,
  ArticlesCatalogFile,
  ArticlesImportReport,
  CustomerGroupId,
} from '../src/domain/articleTypes.ts';
import type { LicenseType, Metric, ProductCode } from '../src/domain/types.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const WORKSPACE = resolve(ROOT, '..');

const CATALOG_PATH = join(ROOT, 'src/data/articlesCatalog.json');
const REPORT_PATH = join(ROOT, 'src/data/articlesImportReport.json');

const EXPECTED_SHEETS = [
  'АМ ',
  'СМ',
  'PAM',
  'ITDR',
  'Шаблоны',
  'Сертификаты внедрения',
  'СВ',
  'Служебные',
] as const;

const TEMPLATE_SHEETS = new Set(['Шаблоны', 'Служебные']);

const SKU_RE =
  /^(?:[A-ZА-Я]{1,4}-)?[A-Za-zА-Яа-я]{0,4}-?\d[\dA-Za-zА-Яа-я-]*$/u;

interface ColumnRole {
  col: number;
  role: string;
  certification: 'ordinary' | 'fstec' | null;
  customerGroupId: CustomerGroupId;
}

interface ParsedRowContext {
  groupLabel: string | null;
  name: string | null;
}

function findExcelFiles(): string[] {
  const candidates: string[] = [];
  const direct = join(ROOT, 'reference/артикулы_09.04.2026 копия.xlsx');
  if (existsSync(direct)) candidates.push(direct);

  const uploadsDir = join(WORKSPACE, 'uploads');
  if (existsSync(uploadsDir)) {
    for (const name of readdirSync(uploadsDir)) {
      if (/артикул/i.test(name) && /\.xlsx$/i.test(name)) {
        candidates.push(join(uploadsDir, name));
      }
    }
  }

  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue;
        walk(full);
      } else if (/артикул/i.test(name) && /\.xlsx$/i.test(name)) {
        candidates.push(full);
      }
    }
  };
  walk(WORKSPACE);

  return [...new Set(candidates)];
}

function colLetter(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellRef(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function stableId(sheet: string, row: number, col: number, sku: string): string {
  return `${sheet}|${cellRef(row, col)}|${sku}`;
}

function normalizeCell(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === '0' || text === '—' || text === '-') return null;
  if (text.toUpperCase() === 'PF') return null;
  return text;
}

function looksLikeSku(value: string): boolean {
  if (!SKU_RE.test(value)) return false;
  if (/^(PF|PAM|AM|CM|ITDR|GAM|Gpam)$/i.test(value)) return false;
  return /\d/.test(value);
}

function productFromSheet(sheet: string): ProductCode | null {
  if (sheet.startsWith('АМ')) return 'AM';
  if (sheet === 'СМ') return 'CM';
  if (sheet === 'PAM') return 'PAM';
  if (sheet === 'ITDR') return 'ITDR';
  if (sheet === 'СВ') return null;
  if (sheet === 'Сертификаты внедрения') return null;
  return null;
}

function pamColumnRoles(maxCol: number): ColumnRole[] {
  const roles: ColumnRole[] = [];
  const map: Array<[number, string, 'ordinary' | 'fstec' | null, CustomerGroupId]> = [
    [2, 'standard', 'ordinary', 'standard'],
    [3, 'fstec', 'fstec', 'standard'],
    [4, 'gazprom', 'ordinary', 'gazprom'],
    [5, 'gazprom_fstec', 'fstec', 'gazprom'],
    [6, 'client_1', 'ordinary', 'standard'],
    [7, 'client_2', 'ordinary', 'standard'],
  ];
  for (const [col, role, cert, group] of map) {
    if (col <= maxCol) roles.push({ col, role, certification: cert, customerGroupId: group });
  }
  for (let col = 8; col <= maxCol; col++) {
    roles.push({
      col,
      role: `client_${col - 5}`,
      certification: 'ordinary',
      customerGroupId: 'standard',
    });
  }
  return roles;
}

function amCmColumnRoles(maxCol: number): ColumnRole[] {
  const roles: ColumnRole[] = [
    { col: 2, role: 'standard', certification: 'ordinary', customerGroupId: 'standard' },
    { col: 3, role: 'gazprom', certification: 'ordinary', customerGroupId: 'gazprom' },
    { col: 4, role: 'client_1', certification: 'ordinary', customerGroupId: 'standard' },
    { col: 5, role: 'fstec', certification: 'fstec', customerGroupId: 'fstec' },
  ];
  for (let col = 6; col <= maxCol; col++) {
    roles.push({
      col,
      role: `client_${col - 3}`,
      certification: 'ordinary',
      customerGroupId: 'standard',
    });
  }
  return roles;
}

function inferLicenseFromSku(sku: string): { licenseType: LicenseType | 'not_applicable'; termMonths: number | null } {
  const sub = sku.match(/(\d{2})(\d{4})(\d+)/);
  if (sub) {
    const termCode = Number(sub[2]);
    if (termCode >= 120000 && termCode < 130000) return { licenseType: 'subscription', termMonths: 12 };
    if (termCode >= 240000) return { licenseType: 'subscription', termMonths: 24 };
    if (termCode >= 60000 && termCode < 70000) return { licenseType: 'subscription', termMonths: 6 };
  }
  if (/^\d{11,}$/.test(sku.replace(/[^0-9]/g, '')) && /12\d{4}/.test(sku)) {
    return { licenseType: 'subscription', termMonths: 12 };
  }
  if (/ITDR\d{8}/.test(sku)) {
    if (sku.includes('2400')) return { licenseType: 'subscription', termMonths: 24 };
    return { licenseType: 'subscription', termMonths: 12 };
  }
  if (/^ITDR-\d{2}-\d+$/u.test(sku)) {
    return { licenseType: 'perpetual', termMonths: null };
  }
  if (/^СВ-/u.test(sku)) {
    return { licenseType: 'not_applicable', termMonths: null };
  }
  if (/000000/.test(sku) || /-0{5,}/.test(sku)) {
    return { licenseType: 'perpetual', termMonths: null };
  }
  if (/01\d{4}\d+/.test(sku)) {
    return { licenseType: 'subscription', termMonths: 12 };
  }
  return { licenseType: 'subscription', termMonths: 12 };
}

function inferPackageCapacity(sku: string, name: string | null): number | null {
  const fromName = name?.match(/(\d+)\s*пользовател/i);
  if (fromName) return Number(fromName[1]);
  const m = sku.match(/(\d{2})(\d{4})(\d+)/);
  if (m) return Number(m[3]);
  const tail = sku.match(/(\d{2,3})$/);
  if (tail && sku.startsWith('PAM')) return Number(tail[1]);
  return null;
}

function inferItemId(product: ProductCode, sku: string, name: string | null, kind: ArticleEntryKind): string | null {
  if (kind === 'implementation_cert') return null;
  if (product === 'AM') {
    if (/windows logon|wl/i.test(name ?? '') || /00000006/.test(sku)) return 'AM.WINDOWS_LOGON';
    return 'AM.BASE';
  }
  if (product === 'CM') {
    if (/агент|agent/i.test(name ?? '')) return 'CM.WINDOWS.AGENT';
    return 'CM.WINDOWS.BASE';
  }
  if (product === 'PAM') {
    if (/подключен|concurrent|cs/i.test(name ?? '') || /02\d{4}/.test(sku)) return 'PAM.CS';
    return 'PAM.UL';
  }
  if (product === 'ITDR') {
    if (/mfa/i.test(name ?? '') || /02/.test(sku)) return 'ITDR.MFA';
    return 'ITDR.MONITORING';
  }
  return null;
}

function inferKind(
  sheet: string,
  sku: string,
  row: number,
  product: ProductCode | null,
): ArticleEntryKind {
  if (sheet === 'Сертификаты внедрения' || /^СВ-/u.test(sku)) return 'implementation_cert';
  if (sheet === 'СВ') return 'special';
  if (TEMPLATE_SHEETS.has(sheet)) return 'special';
  if (product === 'PAM' && row >= 689 && row <= 689) return 'needs_review';
  if (/^PF-\d+$/i.test(sku) && !/^PF-\d{8}/i.test(sku)) return 'needs_review';
  if (/Gpam/i.test(sku)) return 'customer_variant';
  if (/^GAM-/i.test(sku)) return 'customer_variant';
  if (/^АCM-/u.test(sku)) return 'customer_variant';
  if (product === 'PAM' && /01\d{4}25|01000025|01120025/.test(sku)) return 'package_ul';
  if (product === 'PAM' && /02\d{4}/.test(sku)) return 'package_cs';
  if (/00000001$/.test(sku)) return 'perpetual_base';
  if (/12000001$/.test(sku)) return 'subscription';
  return 'module';
}

function inferMetric(product: ProductCode | null, kind: ArticleEntryKind): Metric | null {
  if (kind === 'implementation_cert') return null;
  if (product === 'PAM' && kind === 'package_cs') return 'concurrent_sessions';
  if (product === 'PAM') return 'users';
  if (product === 'ITDR') return 'licensed_units';
  if (product === 'AM' || product === 'CM') return 'users';
  return null;
}

function classifyQuality(
  sheet: string,
  row: number,
  col: number,
  kind: ArticleEntryKind,
): ArticleEntryQuality {
  if (sheet === 'PAM' && row >= 689 && row <= 689 && col >= 2 && col <= 37) return 'ambiguous';
  if (kind === 'needs_review') return 'needs_review';
  if (TEMPLATE_SHEETS.has(sheet)) return 'needs_review';
  return 'confirmed';
}

function parseProductSheet(
  sheetName: string,
  ws: XLSX.WorkSheet,
  entries: ArticleEntry[],
  issues: string[],
): number {
  const product = productFromSheet(sheetName);
  if (!product || TEMPLATE_SHEETS.has(sheetName)) return 0;

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  let maxCol = 0;
  for (const row of rows) {
    if (row) maxCol = Math.max(maxCol, row.length - 1);
  }

  const columnRoles =
    sheetName === 'PAM' ? pamColumnRoles(maxCol) : amCmColumnRoles(maxCol);

  let current: ParsedRowContext = { groupLabel: null, name: null };
  let count = 0;

  for (let row = 0; row < rows.length; row++) {
    const line = rows[row] ?? [];
    const colA = normalizeCell(line[0]);
    const colB = normalizeCell(line[1]);

    if (colA && !colB && colA.length > 2) {
      current.groupLabel = colA;
    }
    if (colB && colB.length > 8 && !looksLikeSku(colB)) {
      current.name = colB;
    }

    for (const role of columnRoles) {
      const raw = normalizeCell(line[role.col]);
      if (!raw || !looksLikeSku(raw)) continue;

      const sku = raw;
      const name = current.name ?? colB ?? sku;
      const kind = inferKind(sheetName, sku, row, product);
      if (TEMPLATE_SHEETS.has(sheetName)) continue;

      const license = inferLicenseFromSku(sku);
      const metric = inferMetric(product, kind);
      const packageCapacity =
        product === 'PAM' && (kind === 'package_ul' || kind === 'package_cs')
          ? inferPackageCapacity(sku, name)
          : null;
      const quality = classifyQuality(sheetName, row, role.col, kind);
      const issuesForEntry: string[] = [];
      if (quality === 'ambiguous') issuesForEntry.push('PAM C690:AL690 ambiguous range');
      if (quality === 'needs_review') issuesForEntry.push('Classification needs review');

      const entry: ArticleEntry = {
        id: stableId(sheetName, row, role.col, sku),
        sku,
        name,
        product,
        kind,
        itemId: inferItemId(product, sku, name, kind),
        licenseType: license.licenseType,
        termMonths: license.termMonths,
        packageCapacity,
        metric,
        certification: role.certification,
        customerGroupId: role.customerGroupId,
        quality,
        sources: [{ sheet: sheetName, cell: cellRef(row, role.col), columnRole: role.role }],
        issues: issuesForEntry,
        excludedByDefault: kind === 'special' || kind === 'one_off' || kind === 'implementation_cert',
        groupLabel: current.groupLabel,
      };
      entries.push(entry);
      count++;
    }
  }

  if (rows.length === 0) {
    issues.push(`Sheet "${sheetName}" is empty or unreadable`);
  }

  return count;
}

function parseImplementationSheet(
  sheetName: string,
  ws: XLSX.WorkSheet,
  entries: ArticleEntry[],
): number {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  let count = 0;
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row] ?? [];
    for (let col = 0; col < line.length; col++) {
      const raw = normalizeCell(line[col]);
      if (!raw || !looksLikeSku(raw)) continue;
      if (!/^СВ-/u.test(raw) && sheetName === 'Сертификаты внедрения' && row < 3) continue;

      const sku = raw;
      const product: ProductCode =
        sku.includes('AM') ? 'AM' : sku.includes('CM') ? 'CM' : sku.includes('PAM') ? 'PAM' : 'AM';
      const name = normalizeCell(line[1]) ?? `Сертификат внедрения ${sku}`;

      entries.push({
        id: stableId(sheetName, row, col, sku),
        sku,
        name,
        product,
        kind: 'implementation_cert',
        itemId: null,
        licenseType: 'not_applicable',
        termMonths: null,
        packageCapacity: null,
        metric: null,
        certification: null,
        customerGroupId: 'standard',
        quality: 'confirmed',
        sources: [{ sheet: sheetName, cell: cellRef(row, col), columnRole: 'implementation' }],
        issues: [],
        excludedByDefault: true,
        groupLabel: null,
      });
      count++;
    }
  }
  return count;
}

function parseItdrSheet(ws: XLSX.WorkSheet, entries: ArticleEntry[]): number {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  let currentName: string | null = null;
  let count = 0;

  for (let row = 0; row < rows.length; row++) {
    const line = rows[row] ?? [];
    const colB = normalizeCell(line[1]);
    if (colB && colB.length > 8 && !looksLikeSku(colB)) currentName = colB;

    for (let col = 2; col < line.length; col++) {
      const raw = normalizeCell(line[col]);
      if (!raw || !looksLikeSku(raw)) continue;
      if (!/^ITDR/i.test(raw)) continue;

      const sku = raw;
      const license = inferLicenseFromSku(sku);
      const itemId = /02|MFA/i.test(`${sku} ${currentName ?? ''}`) ? 'ITDR.MFA' : 'ITDR.MONITORING';

      entries.push({
        id: stableId('ITDR', row, col, sku),
        sku,
        name: currentName ?? sku,
        product: 'ITDR',
        kind: license.licenseType === 'perpetual' ? 'perpetual_base' : 'subscription',
        itemId,
        licenseType: license.licenseType,
        termMonths: license.termMonths,
        packageCapacity: null,
        metric: 'licensed_units',
        certification: 'ordinary',
        customerGroupId: 'standard',
        quality: 'confirmed',
        sources: [{ sheet: 'ITDR', cell: cellRef(row, col), columnRole: col === 2 ? 'standard' : 'term_variant' }],
        issues: [],
        excludedByDefault: false,
        groupLabel: null,
      });
      count++;
    }
  }
  return count;
}

function parseWorkbook(filePath: string): { catalog: ArticlesCatalogFile; report: ArticlesImportReport } {
  const fileName = basename(filePath);
  const buffer = readFileSync(filePath);
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const importedAt = new Date().toISOString();

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const entries: ArticleEntry[] = [];
  const issues: string[] = [];
  const sheetStats: Record<string, number> = {};

  for (const sheetName of EXPECTED_SHEETS) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
      issues.push(`Missing expected sheet: ${sheetName}`);
      sheetStats[sheetName] = 0;
      continue;
    }

    let count = 0;
    if (sheetName === 'ITDR') {
      count = parseItdrSheet(ws, entries);
    } else if (sheetName === 'Сертификаты внедрения' || sheetName === 'СВ') {
      count = parseImplementationSheet(sheetName, ws, entries);
    } else if (!TEMPLATE_SHEETS.has(sheetName)) {
      count = parseProductSheet(sheetName, ws, entries, issues);
    }
    sheetStats[sheetName] = count;
  }

  const deduped = new Map<string, ArticleEntry>();
  for (const entry of entries) {
    deduped.set(entry.id, entry);
  }
  const finalEntries = [...deduped.values()].sort((a, b) => a.sku.localeCompare(b.sku, 'ru'));

  const catalog: ArticlesCatalogFile = {
    catalogVersion: importedAt.slice(0, 10),
    source: { fileName, fileHash, importedAt },
    importStatus: 'ok',
    entries: finalEntries,
    specialExcludedByDefault: true,
  };

  const report: ArticlesImportReport = {
    status: 'ok',
    message: `Импортировано ${finalEntries.length} артикулов из ${fileName}`,
    importedAt,
    rowCount: finalEntries.length,
    fileName,
    fileHash,
    sheetStats,
    issues,
  };

  return { catalog, report };
}

function writeMissingSource(): void {
  const catalog: ArticlesCatalogFile = {
    catalogVersion: null,
    source: null,
    importStatus: 'missing_source',
    entries: [],
    specialExcludedByDefault: true,
  };
  const report: ArticlesImportReport = {
    status: 'missing_source',
    message: 'Файл Excel со справочником артикулов не найден. Импорт не выполнялся.',
    importedAt: null,
    rowCount: 0,
    fileName: null,
    fileHash: null,
    issues: [
      'Expected file: reference/артикулы_09.04.2026 копия.xlsx',
      'Also searched uploads/ and *артикул*.xlsx under workspace',
    ],
  };
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main(): number {
  const files = findExcelFiles();
  if (files.length === 0) {
    writeMissingSource();
    console.error('Excel source not found. Wrote missing_source report to src/data/articlesImportReport.json');
    return 2;
  }

  const filePath = files[0];
  console.log(`Importing articles from: ${filePath}`);
  try {
    const { catalog, report } = parseWorkbook(filePath);
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(report.message);
    if (report.issues?.length) {
      console.warn('Import issues:', report.issues.join('; '));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const catalog: ArticlesCatalogFile = {
      catalogVersion: null,
      source: null,
      importStatus: 'error',
      entries: [],
      specialExcludedByDefault: true,
    };
    const report: ArticlesImportReport = {
      status: 'error',
      message: `Ошибка импорта: ${message}`,
      importedAt: new Date().toISOString(),
      rowCount: 0,
      fileName: basename(filePath),
      issues: [message],
    };
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(message);
    return 1;
  }
}

process.exit(main());
