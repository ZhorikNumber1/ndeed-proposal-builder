/**
 * Dev-only Excel → articlesCatalog.json importer.
 * Run: npm run import:articles
 */
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
  'Сертификаты на поддержку',
  'Сертификаты на внедрение',
  'разовыеуникальные артикулы',
  'рабочий лист',
] as const;

/** PAM client column map (0-based): C=2 … T=19 */
const PAM_COLUMN_MAP: Array<{
  col: number;
  role: string;
  certification: 'ordinary' | 'fstec' | null;
  customerGroupId: CustomerGroupId | 'unresolved';
  rawLabel: string;
}> = [
  { col: 2, role: 'standard', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Основные' },
  { col: 3, role: 'standard_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'Основные ФСТЭК' },
  { col: 4, role: 'gazprom', certification: 'ordinary', customerGroupId: 'gazprom', rawLabel: 'Газпром' },
  { col: 5, role: 'gazprom_fstec', certification: 'fstec', customerGroupId: 'gazprom', rawLabel: 'Газпром ФСТЭК' },
  { col: 6, role: 'dzo_gpb', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'ДЗО ГПБ' },
  { col: 7, role: 'dzo_gpb_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'ДЗО ГПБ ФСТЭК' },
  { col: 8, role: 'rosatom', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Росатом' },
  { col: 9, role: 'rosatom_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'Росатом ФСТЭК' },
  { col: 10, role: 'rosneft', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Роснефть' },
  { col: 11, role: 'rosneft_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'Роснефть ФСТЭК' },
  { col: 12, role: 'rosseti', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Россети' },
  { col: 13, role: 'rosseti_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'Россети ФСТЭК' },
  { col: 14, role: 'rushydro', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'РусГидро' },
  { col: 15, role: 'rushydro_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'РусГидро ФСТЭК' },
  { col: 16, role: 'depir', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'ДЭПиР' },
  { col: 17, role: 'depir_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'ДЭПиР ФСТЭК' },
  { col: 18, role: 'aviation', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Авиационная группа' },
  { col: 19, role: 'aviation_fstec', certification: 'fstec', customerGroupId: 'standard', rawLabel: 'Авиационная группа ФСТЭК' },
];

const AM_CM_COLUMNS: Array<{
  col: number;
  role: string;
  certification: 'ordinary' | 'fstec' | null;
  customerGroupId: CustomerGroupId;
  rawLabel: string;
}> = [
  { col: 2, role: 'standard', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Основные' },
  { col: 3, role: 'gazprom', certification: 'ordinary', customerGroupId: 'gazprom', rawLabel: 'Газпром' },
  { col: 4, role: 'dzo_gpb', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'ДЗО ГПБ' },
  { col: 5, role: 'rosatom', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'Росатом' },
  { col: 6, role: 'rushydro', certification: 'ordinary', customerGroupId: 'standard', rawLabel: 'РусГидро' },
];

function findExcel(): string | null {
  const preferred = join(ROOT, 'reference/артикулы_09.04.2026 копия.xlsx');
  if (existsSync(preferred)) return preferred;

  const dirs = [
    join(WORKSPACE, 'uploads'),
    join('/home/ubuntu/.cursor/projects/workspace/uploads'),
    join(ROOT, 'uploads'),
    join(ROOT, 'reference'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (/\.xlsx$/i.test(name) && (/артикул/i.test(name) || /09\.04\.2026/.test(name) || /______/.test(name))) {
        return join(dir, name);
      }
    }
  }

  const walk = (dir: string, depth = 0): string | null => {
    if (depth > 4 || !existsSync(dir)) return null;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          const hit = walk(full, depth + 1);
          if (hit) return hit;
        } else if (/\.xlsx$/i.test(name) && /артикул|09\.04/i.test(name)) {
          return full;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  };
  return walk(WORKSPACE);
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

function cellAddr(row0: number, col0: number): string {
  return `${colLetter(col0)}${row0 + 1}`;
}

function sheetRange(sheet: XLSX.WorkSheet): { r0: number; r1: number; c0: number; c1: number } | null {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const decoded = XLSX.utils.decode_range(ref);
  return { r0: decoded.s.r, r1: decoded.e.r, c0: decoded.s.c, c1: decoded.e.c };
}

function cellText(sheet: XLSX.WorkSheet, row0: number, col0: number): string | null {
  const addr = cellAddr(row0, col0);
  return asText(sheet[addr]?.v);
}

function fillGroupColumn(sheet: XLSX.WorkSheet, r0: number, r1: number): Map<number, string> {
  const map = new Map<number, string>();
  let last: string | null = null;
  for (let r = r0; r <= r1; r++) {
    const g = cellText(sheet, r, 0);
    if (g && !isSkuCandidate(g)) last = g;
    if (last) map.set(r, last);
  }
  return map;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (value === 0) return null;
    return String(value);
  }
  const t = String(value).trim();
  if (!t || t === '0' || t === '—' || t === '-' || t === '–') return null;
  return t;
}

function isSkuCandidate(text: string): boolean {
  if (text.toUpperCase() === 'PF') return false;
  if (!/\d/.test(text)) return false;
  if (text.length < 4) return false;
  // Reject pure prose
  if (/\s{2,}/.test(text) && text.length > 40) return false;
  if (/^Неисключительные|^Сертификат|^продажа/i.test(text)) return false;
  return /[A-Za-zА-Яа-я]/.test(text);
}

function inferPackageCapacity(name: string | null): number | null {
  if (!name) return null;
  const m =
    name.match(/пакет\s*на\s*[-–—]?\s*(\d+)\s*пользовател/i) ||
    name.match(/на\s+(\d+)\s*пользовател/i) ||
    name.match(/(\d+)\s*пользовател/i);
  return m ? Number(m[1]) : null;
}

function inferMetric(name: string | null, group: string | null): Metric | null {
  const hay = `${group ?? ''} ${name ?? ''}`.toLowerCase();
  if (/одновремен|concurrent|\bcs\b/.test(hay)) return 'concurrent_sessions';
  if (/ресурс/.test(hay)) return 'resources';
  if (/service\s*account|учетн/.test(hay)) return 'service_accounts';
  if (/пользовател|\bul\b|пакет/.test(hay)) return 'users';
  if (/monitoring|mfa|itdr/.test(hay)) return 'licensed_units';
  return null;
}

function inferLicense(name: string | null, group: string | null): {
  licenseType: LicenseType | 'not_applicable' | null;
  termMonths: number | null;
} {
  const hay = `${group ?? ''} ${name ?? ''}`.toLowerCase();
  if (/бессроч/.test(hay)) return { licenseType: 'perpetual', termMonths: null };
  if (/сертификат\s+на\s+внедрение|внедрен/.test(hay)) {
    return { licenseType: 'not_applicable', termMonths: null };
  }

  let months: number | null = null;
  const years =
    hay.match(/на\s+(\d+)\s*\([^)]+\)\s*года?/) ||
    hay.match(/на\s+(\d+)\s*года?/) ||
    hay.match(/(\d+)\s*\([^)]+\)\s*года?/) ||
    hay.match(/(\d+)\s*года?/);
  const termMonths =
    hay.match(/на\s+(\d+)\s*мес/) ||
    hay.match(/(\d+)\s*мес/);
  if (/на\s+1\s*\(один\)\s*год|на\s+1\s+год|12\s*мес/.test(hay)) months = 12;
  else if (years) {
    const n = Number(years[1]);
    months = Number.isFinite(n) ? n * 12 : null;
  } else if (termMonths) {
    const n = Number(termMonths[1]);
    months = Number.isFinite(n) ? n : null;
  }

  if (
    /подписк|срочн|обновлен|на\s+\d+\s*\([^)]+\)\s*года?|на\s+\d+\s*года?|\d+\s*мес/.test(hay) ||
    months != null
  ) {
    return { licenseType: 'subscription', termMonths: months ?? 12 };
  }
  return { licenseType: null, termMonths: null };
}

function inferKind(
  product: ProductCode | null,
  name: string | null,
  group: string | null,
  metric: Metric | null,
  licenseType: LicenseType | 'not_applicable' | null,
): ArticleEntryKind {
  const hay = `${group ?? ''} ${name ?? ''}`.toLowerCase();
  if (/сертификат\s+на\s+внедрение|внедрен/.test(hay)) return 'implementation_cert';
  if (/модул/.test(hay) && !/пакет/.test(hay)) return 'module';
  if (product === 'PAM' && metric === 'users') return 'package_ul';
  if (product === 'PAM' && metric === 'concurrent_sessions') return 'package_cs';
  if (licenseType === 'subscription') return 'subscription';
  if (licenseType === 'perpetual') return 'perpetual_base';
  if (/разовые|уникальн|special/.test(hay)) return 'special';
  return 'needs_review';
}

function inferItemId(
  product: ProductCode | null,
  kind: ArticleEntryKind,
  metric: Metric | null,
  name: string | null,
): string | null {
  if (!product) return null;
  const hay = (name ?? '').toLowerCase();
  if (product === 'PAM') {
    if (/aapm/.test(hay)) return 'PAM.AAPM';
    if (/sql\s*proxy/.test(hay)) return 'PAM.SQL_PROXY';
    if (metric === 'concurrent_sessions' || kind === 'package_cs') return 'PAM.CS';
    if (metric === 'resources') return 'PAM.RL';
    if (kind === 'package_ul' || metric === 'users') return 'PAM.UL';
    if (kind === 'module') return null;
    return 'PAM.UL';
  }
  if (product === 'AM') {
    if (/windows\s*logon|\bwl\b/.test(hay)) return 'AM.WINDOWS_LOGON';
    if (/linux\s*logon/.test(hay)) return 'AM.LINUX_LOGON';
    if (/rdp/.test(hay)) return 'AM.RDP_LOGON';
    if (/ldap/.test(hay)) return 'AM.LDAP_PROXY';
    if (/esso|sso/.test(hay)) return 'AM.ESSO';
    if (/nps/.test(hay)) return 'AM.NPS_RADIUS';
    if (/freeradius/.test(hay)) return 'AM.FREERADIUS';
    if (/adfs/.test(hay)) return 'AM.ADFS';
    if (/модул/.test(hay)) return null;
    return 'AM.BASE';
  }
  if (product === 'CM') {
    if (/agent|агент/.test(hay)) return 'CM.WINDOWS.AGENT';
    return 'CM.WINDOWS.BASE';
  }
  if (product === 'ITDR') {
    if (/mfa/.test(hay)) return 'ITDR.MFA';
    if (/monitoring/.test(hay)) return 'ITDR.MONITORING';
    return null;
  }
  return null;
}

function makeEntry(params: {
  sheet: string;
  row0: number;
  col0: number;
  sku: string;
  name: string | null;
  group: string | null;
  product: ProductCode | null;
  certification: 'ordinary' | 'fstec' | null;
  customerGroupId: CustomerGroupId;
  columnRole: string;
  quality?: ArticleEntryQuality;
  issues?: string[];
  excludedByDefault?: boolean;
  kindOverride?: ArticleEntryKind;
}): ArticleEntry {
  const { licenseType, termMonths } = inferLicense(params.name, params.group);
  const metric = inferMetric(params.name, params.group);
  const packageCapacity = inferPackageCapacity(params.name);
  const kind =
    params.kindOverride ??
    (params.customerGroupId !== 'standard' && params.columnRole !== 'standard' && params.columnRole !== 'standard_fstec'
      ? 'customer_variant'
      : inferKind(params.product, params.name, params.group, metric, licenseType));
  const product = params.product ?? 'PAM';
  const itemId = inferItemId(params.product, kind, metric, params.name);
  const issues = [...(params.issues ?? [])];
  let quality: ArticleEntryQuality = params.quality ?? 'confirmed';
  let excludedByDefault =
    params.excludedByDefault ??
    (kind === 'special' || kind === 'one_off' || kind === 'implementation_cert');
  const hay = `${params.group ?? ''} ${params.name ?? ''}`.toLowerCase();
  if (/обновлен/.test(hay)) {
    issues.push('update_sku');
    excludedByDefault = true;
    if (quality === 'confirmed') quality = 'needs_review';
  }
  if (!params.product) {
    issues.push('product_unspecified');
    quality = 'needs_review';
  }
  if (kind === 'needs_review') quality = 'needs_review';

  return {
    id: `${params.sheet}|${cellAddr(params.row0, params.col0)}|${params.sku}`,
    sku: params.sku,
    name: params.name ?? params.sku,
    product,
    kind,
    itemId,
    licenseType,
    termMonths,
    packageCapacity,
    metric,
    certification: params.certification,
    customerGroupId: params.customerGroupId,
    quality,
    sources: [
      {
        sheet: params.sheet,
        cell: cellAddr(params.row0, params.col0),
        columnRole: params.columnRole,
      },
    ],
    issues,
    excludedByDefault,
    groupLabel: params.group,
  };
}

function importAmCm(sheetName: string, sheet: XLSX.WorkSheet, product: ProductCode, maxSkuCol: number): ArticleEntry[] {
  const entries: ArticleEntry[] = [];
  const range = sheetRange(sheet);
  if (!range) return entries;
  const groups = fillGroupColumn(sheet, range.r0, range.r1);
  const cols = AM_CM_COLUMNS.filter((c) => c.col <= maxSkuCol);
  for (let r = range.r0; r <= range.r1; r++) {
    const name = cellText(sheet, r, 1);
    for (const col of cols) {
      const sku = cellText(sheet, r, col.col);
      if (!sku || !isSkuCandidate(sku)) continue;
      entries.push(
        makeEntry({
          sheet: sheetName,
          row0: r,
          col0: col.col,
          sku,
          name,
          group: groups.get(r) ?? null,
          product,
          certification: col.certification,
          customerGroupId: col.customerGroupId,
          columnRole: col.role,
        }),
      );
    }
  }
  return entries;
}

function importPam(sheetName: string, sheet: XLSX.WorkSheet): ArticleEntry[] {
  const entries: ArticleEntry[] = [];
  const range = sheetRange(sheet);
  if (!range) return entries;
  const groups = fillGroupColumn(sheet, range.r0, range.r1);
  for (let r = range.r0; r <= range.r1; r++) {
    const name = cellText(sheet, r, 1);
    const excelRow = r + 1;
    const ambiguousHorizontal = excelRow === 690;

    for (const col of PAM_COLUMN_MAP) {
      const sku = cellText(sheet, r, col.col);
      if (!sku || !isSkuCandidate(sku)) continue;
      const customerGroupId: CustomerGroupId =
        col.customerGroupId === 'gazprom' ? 'gazprom' : 'standard';
      const issues: string[] = [];
      let quality: ArticleEntryQuality = 'confirmed';
      if (ambiguousHorizontal) {
        issues.push('pam_horizontal_pack_ambiguous_C690_AL690');
        quality = 'ambiguous';
      }
      const isCustomerCol = col.role !== 'standard' && col.role !== 'standard_fstec';
      entries.push(
        makeEntry({
          sheet: sheetName,
          row0: r,
          col0: col.col,
          sku,
          name,
          group: groups.get(r) ?? null,
          product: 'PAM',
          certification: col.certification,
          customerGroupId,
          columnRole: col.role,
          quality,
          issues,
          kindOverride: ambiguousHorizontal ? 'needs_review' : isCustomerCol ? 'customer_variant' : undefined,
        }),
      );
    }

    if (ambiguousHorizontal) {
      for (let c = 20; c <= range.c1; c++) {
        const sku = cellText(sheet, r, c);
        if (!sku || !isSkuCandidate(sku)) continue;
        entries.push(
          makeEntry({
            sheet: sheetName,
            row0: r,
            col0: c,
            sku,
            name,
            group: groups.get(r) ?? null,
            product: 'PAM',
            certification: null,
            customerGroupId: 'standard',
            columnRole: `unmapped_col_${colLetter(c)}`,
            quality: 'ambiguous',
            issues: ['pam_horizontal_pack_ambiguous_C690_AL690', 'column_not_in_client_map'],
            kindOverride: 'needs_review',
          }),
        );
      }
    }
  }
  return entries;
}

function fillItdrGroupColumn(sheet: XLSX.WorkSheet, r0: number, r1: number): Map<number, string> {
  const map = new Map<number, string>();
  let last: string | null = null;
  for (let r = r0; r <= r1; r++) {
    const a = cellText(sheet, r, 0);
    const b = cellText(sheet, r, 1);
    if (b && /^(лицензия\s|indeed\s*itdr[\s])/i.test(b)) {
      last = b;
    }
    if (a && !isSkuCandidate(a) && /гарантия|мес|год/i.test(a)) {
      last = last ? `${last}; ${a}` : a;
    }
    if (last) map.set(r, last);
  }
  return map;
}

function importItdr(sheetName: string, sheet: XLSX.WorkSheet): ArticleEntry[] {
  const entries: ArticleEntry[] = [];
  const range = sheetRange(sheet);
  if (!range) return entries;
  const groups = fillItdrGroupColumn(sheet, range.r0, range.r1);
  for (let r = range.r0; r <= range.r1; r++) {
    const name = cellText(sheet, r, 1);
    const sku = cellText(sheet, r, 2);
    if (!sku || !isSkuCandidate(sku)) continue;
    // Skip section labels mistakenly placed in C (e.g. «основные»)
    if (/^основные$/i.test(sku)) continue;
    entries.push(
      makeEntry({
        sheet: sheetName,
        row0: r,
        col0: 2,
        sku,
        name,
        group: groups.get(r) ?? null,
        product: 'ITDR',
        certification: 'ordinary',
        customerGroupId: 'standard',
        columnRole: 'standard',
      }),
    );
  }
  return entries;
}

function importImplementation(sheetName: string, sheet: XLSX.WorkSheet): ArticleEntry[] {
  const entries: ArticleEntry[] = [];
  const range = sheetRange(sheet);
  if (!range) return entries;
  for (let r = range.r0; r <= range.r1; r++) {
    const sku = cellText(sheet, r, 0);
    const name = cellText(sheet, r, 1);
    if (!sku || !isSkuCandidate(sku)) continue;
    if (!/^СВ-/u.test(sku) && !/^CB-/i.test(sku)) continue;
    let product: ProductCode | null = null;
    if (/AM/i.test(sku)) product = 'AM';
    else if (/CM/i.test(sku)) product = 'CM';
    else if (/PAM/i.test(sku)) product = 'PAM';
    entries.push(
      makeEntry({
        sheet: sheetName,
        row0: r,
        col0: 0,
        sku,
        name,
        group: 'Сертификаты на внедрение',
        product,
        certification: null,
        customerGroupId: 'standard',
        columnRole: 'implementation',
        kindOverride: 'implementation_cert',
        excludedByDefault: true,
      }),
    );
  }
  return entries;
}

function importOneOff(sheetName: string, sheet: XLSX.WorkSheet): ArticleEntry[] {
  const entries: ArticleEntry[] = [];
  const range = sheetRange(sheet);
  if (!range) return entries;
  for (let r = range.r0; r <= range.r1; r++) {
    const main = cellText(sheet, r, 1);
    const special = cellText(sheet, r, 2);
    const desc = cellText(sheet, r, 3) ?? cellText(sheet, r, 0);
    const sku = special ?? main;
    if (!sku || !isSkuCandidate(sku)) continue;
    let product: ProductCode | null = null;
    if (/^AM|GAM|АM/i.test(sku) || /Access Manager/i.test(desc ?? '')) product = 'AM';
    else if (/^CM|АCM|ACM/i.test(sku) || /Credential|Certificate Manager/i.test(desc ?? '')) product = 'CM';
    else if (/^PAM|PF|Gpam/i.test(sku) || /Privileged Access/i.test(desc ?? '')) product = 'PAM';
    else if (/^ITDR/i.test(sku)) product = 'ITDR';
    entries.push(
      makeEntry({
        sheet: sheetName,
        row0: r,
        col0: special ? 2 : 1,
        sku,
        name: desc,
        group: 'разовыеуникальные артикулы',
        product,
        certification: null,
        customerGroupId: 'standard',
        columnRole: special ? 'special' : 'main',
        kindOverride: 'one_off',
        quality: 'needs_review',
        issues: main && special && main !== special ? [`paired_main:${main}`] : [],
        excludedByDefault: true,
      }),
    );
  }
  return entries;
}

function writeMissing(message: string, issues: string[]): void {
  const report: ArticlesImportReport = {
    status: 'missing_source',
    message,
    importedAt: new Date().toISOString(),
    rowCount: 0,
    fileName: null,
    fileHash: null,
    sheetStats: {},
    issues,
  };
  const catalog: ArticlesCatalogFile = {
    catalogVersion: null,
    source: null,
    importStatus: 'missing_source',
    entries: [],
    specialExcludedByDefault: true,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
}

function main(): number {
  const excelPath = findExcel();
  if (!excelPath) {
    writeMissing('Файл Excel со справочником артикулов не найден. Импорт не выполнялся.', [
      'Expected: reference/артикулы_09.04.2026 копия.xlsx',
      'Also searched uploads/ and workspace *артикул*.xlsx',
    ]);
    console.error('Excel source not found. Wrote missing_source report.');
    return 2;
  }

  const buf = readFileSync(excelPath);
  const fileHash = createHash('sha256').update(buf).digest('hex');
  const fileName = basename(excelPath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });

  const issues: string[] = [];
  const sheetStats: Record<string, number> = {};
  const all: ArticleEntry[] = [];

  for (const expected of EXPECTED_SHEETS) {
    if (!wb.SheetNames.includes(expected)) {
      issues.push(`Missing expected sheet: ${JSON.stringify(expected)}`);
      sheetStats[expected] = 0;
    }
  }
  for (const name of wb.SheetNames) {
    if (!(EXPECTED_SHEETS as readonly string[]).includes(name)) {
      issues.push(`Unexpected sheet present: ${JSON.stringify(name)}`);
    }
  }

  if (wb.Sheets['АМ ']) {
    const e = importAmCm('АМ ', wb.Sheets['АМ '], 'AM', 6);
    sheetStats['АМ '] = e.length;
    all.push(...e);
  }
  if (wb.Sheets['СМ']) {
    const e = importAmCm('СМ', wb.Sheets['СМ'], 'CM', 5);
    sheetStats['СМ'] = e.length;
    all.push(...e);
  }
  if (wb.Sheets.PAM) {
    const e = importPam('PAM', wb.Sheets.PAM);
    sheetStats.PAM = e.length;
    all.push(...e);
  }
  if (wb.Sheets.ITDR) {
    const e = importItdr('ITDR', wb.Sheets.ITDR);
    sheetStats.ITDR = e.length;
    all.push(...e);
  }
  if (wb.Sheets['Сертификаты на внедрение']) {
    const e = importImplementation('Сертификаты на внедрение', wb.Sheets['Сертификаты на внедрение']);
    sheetStats['Сертификаты на внедрение'] = e.length;
    all.push(...e);
  } else {
    sheetStats['Сертификаты на внедрение'] = 0;
  }
  if (wb.Sheets['разовыеуникальные артикулы']) {
    const e = importOneOff('разовыеуникальные артикулы', wb.Sheets['разовыеуникальные артикулы']);
    sheetStats['разовыеуникальные артикулы'] = e.length;
    all.push(...e);
  } else {
    sheetStats['разовыеуникальные артикулы'] = 0;
  }

  // Templates / working sheet — recorded, not as sellable SKUs
  sheetStats['Сертификаты на поддержку'] = 0;
  sheetStats['рабочий лист'] = 0;
  if (wb.Sheets['Сертификаты на поддержку']) {
    issues.push('Sheet «Сертификаты на поддержку»: template only, SKUs not imported');
  }
  if (wb.Sheets['рабочий лист']) {
    issues.push('Sheet «рабочий лист»: examples only, SKUs not imported');
  }

  // Flag incomplete PF
  if (asText(wb.Sheets.PAM?.D722?.v) === 'PF') {
    issues.push('PAM!D722 contains incomplete value «PF» (not imported as SKU)');
  }
  if (wb.Sheets.ITDR?.F12?.v === 0) {
    issues.push('ITDR!F12 = 0 ignored (not a SKU/price)');
  }

  const uniqueSkus = new Set(all.map((e) => e.sku));
  const catalog: ArticlesCatalogFile = {
    catalogVersion: `xlsx-${fileHash.slice(0, 12)}`,
    source: {
      fileName,
      fileHash,
      importedAt: new Date().toISOString(),
    },
    importStatus: 'ok',
    entries: all,
    specialExcludedByDefault: true,
  };

  const report: ArticlesImportReport = {
    status: 'ok',
    message: `Импортировано ${all.length} записей (${uniqueSkus.size} уникальных исходных кодов) из ${fileName}`,
    importedAt: catalog.source!.importedAt,
    rowCount: all.length,
    fileName,
    fileHash,
    sheetStats,
    issues,
  };

  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`Import OK: ${all.length} entries, ${uniqueSkus.size} unique SKUs`);
  console.log('Sheets:', sheetStats);
  if (issues.length) console.log('Notes:', issues);
  return 0;
}

process.exit(main());
