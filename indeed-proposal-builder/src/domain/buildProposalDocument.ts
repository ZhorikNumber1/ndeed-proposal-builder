import contentBlocks from '../data/contentBlocks.json';
import { DEMO_SUPPLIER } from '../data/demoSupplier';
import type {
  ContentBlock,
  DocumentBlock,
  Proposal,
  ProposalDocument,
  ProposalOption,
  QuoteLine,
} from './types';
import { formatDateRuLong } from './dates';
import { formatMoneyPlain } from './money';
import { PRODUCT_NAMES } from '../data/products';
import { FSTEC_KIT } from './pricing';

const blocks = contentBlocks as ContentBlock[];

function matchCondition(
  condition: Record<string, unknown>,
  ctx: {
    product?: string;
    metric?: string;
    itemIds: Set<string>;
    licenseType?: string;
    termMonths?: number | null;
    validityKind?: string;
  },
): boolean {
  const entries = Object.entries(condition);
  if (entries.length === 0) return true;
  for (const [key, value] of entries) {
    if (key === 'always' && value === true) continue;
    if (key === 'product' && ctx.product !== value) return false;
    if (key === 'metric' && ctx.metric !== value) return false;
    if (key === 'has_item' && !ctx.itemIds.has(String(value))) return false;
    if (key === 'option.license_type' && ctx.licenseType !== value) return false;
    if (key === 'option.term_months' && ctx.termMonths !== value) return false;
    if (key === 'option.term_months_not' && ctx.termMonths === value) return false;
    if (key === 'validity.kind' && ctx.validityKind !== value) return false;
  }
  return true;
}

function calendarMonthsText(months: number): string {
  if (months === 1) return 'месяца';
  return `${months} мес.`;
}

function resolveVars(
  text: string,
  vars: Record<string, string>,
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const out = text.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim();
    if (k in vars) return vars[k];
    unresolved.push(k);
    return `⟦${k}⟧`;
  });
  return { text: out, unresolved };
}

function optionItemIds(option: ProposalOption): Set<string> {
  const ids = new Set<string>();
  const moduleIds = new Set<string>();
  for (const c of option.configurations.filter((x) => x.enabled)) {
    if (c.product === 'PAM' && c.kitQuantity > 0) ids.add('PAM.FSTEC_KIT');
    if (c.product === 'PAM' && c.metric === 'users') ids.add('PAM.UL');
    if (c.product === 'PAM' && c.metric === 'concurrent_sessions') ids.add('PAM.CS');
    for (const m of c.modules) {
      moduleIds.add(m.itemId);
      ids.add(m.itemId);
    }
    if (c.product === 'AM') ids.add('AM.BASE');
    if (c.product === 'CM' && c.platform === 'windows') ids.add('CM.WINDOWS.BASE');
  }
  const calc = option.calculation;
  if (calc) {
    for (const line of calc.items) {
      // WL priced as LL must not pull the Linux Logon description unless LL was selected.
      if (
        line.itemId === 'AM.LINUX_LOGON' &&
        moduleIds.has('AM.WINDOWS_LOGON') &&
        !moduleIds.has('AM.LINUX_LOGON')
      ) {
        continue;
      }
      ids.add(line.itemId);
    }
  }
  return ids;
}

function kitVatAmount(option: ProposalOption): number {
  const kitLines = option.calculation?.items.filter((i) => i.itemId === 'PAM.FSTEC_KIT') ?? [];
  return kitLines.reduce((s, l) => s + Number(l.tax.amount ?? 0), 0);
}

function buildVars(
  proposal: Proposal,
  option: ProposalOption | null,
  tableNumber: number,
  footnoteMarker: string,
): Record<string, string> {
  const supplier = DEMO_SUPPLIER;
  const kitVat = option ? kitVatAmount(option) : 0;
  const validity = proposal.validity;
  return {
    'validity.days': validity.kind === 'days' ? String(validity.days) : '',
    'validity.calendar_months_text':
      validity.kind === 'calendar_months' ? calendarMonthsText(validity.months) : '',
    'validity.purchase_year': validity.kind === 'purchase_year' ? String(validity.year) : '',
    'table.number': String(tableNumber),
    'option.price_label': 'РРЦ',
    'footnote.marker': footnoteMarker,
    'support.included_months': String(option?.commercialTerms.supportIncludedMonths ?? 12),
    'kit.vat_rate_percent': String(Math.round(FSTEC_KIT.vatRate * 100)),
    'kit.vat_amount_formatted': formatMoneyPlain(kitVat),
    // Editorial version without unreliable amount-in-words
    'kit.vat_amount_words': 'сумма НДС указана цифрами',
    'certification.certificate_number': supplier.certificateNumber ?? '',
    'supplier.signatory_role': supplier.signatoryRole,
    'supplier.signatory_name': supplier.signatoryName,
  };
}

function tableRows(lines: QuoteLine[]): DocumentBlock & { type: 'table' } {
  const headers = ['№', 'Артикул', 'Позиция', 'Кол-во, шт.', 'Цена, руб. РФ', 'Стоимость, руб. РФ'];
  const rows = lines.map((line, idx) => ({
    cells: [
      String(idx + 1),
      line.sku ?? 'Не уточнён',
      line.description,
      String(line.saleQuantity),
      line.unitPrice != null ? formatMoneyPlain(line.unitPrice) : '—',
      line.lineTotal != null ? formatMoneyPlain(line.lineTotal) : '—',
    ],
  }));
  return { type: 'table', title: '', optionId: '', headers, rows };
}

export function buildProposalDocument(proposal: Proposal): ProposalDocument {
  const supplier = DEMO_SUPPLIER;
  const docBlocks: DocumentBlock[] = [];
  const unresolvedNotes: string[] = [];
  const allUnresolvedVars: string[] = [];

  docBlocks.push({
    type: 'demoBanner',
    text: 'Демонстрационный черновик — локальный расчёт (mode=demo), не корпоративный реестр и не live Excel',
  });

  docBlocks.push({
    type: 'supplierHeader',
    lines: [
      supplier.legalName,
      supplier.address,
      `ИНН ${supplier.inn} | ОГРН ${supplier.ogrn} | КПП ${supplier.kpp}`,
    ],
  });

  docBlocks.push({
    type: 'meta',
    left: `Исх. №${proposal.number || '—'}`,
    center: `от ${formatDateRuLong(proposal.issueDate)}`,
    right: proposal.customer.legalName || '—',
  });

  // Title
  const titleBlock = blocks.find((b) => b.id === 'common.title');
  docBlocks.push({ type: 'heading', level: 1, text: titleBlock?.paragraphs[0] ?? 'Коммерческое предложение' });

  // Products present across options
  const products = new Set(
    proposal.options.flatMap((o) => o.configurations.filter((c) => c.enabled).map((c) => c.product)),
  );

  // Intro per product (once)
  for (const product of products) {
    const intro = blocks.find(
      (b) => b.section === 'intro' && matchCondition(b.condition, { product, itemIds: new Set() }),
    );
    if (intro) {
      for (const p of intro.paragraphs) {
        docBlocks.push({ type: 'paragraph', text: p });
      }
    }
  }

  // Validity once
  const validityBlock = blocks.find((b) =>
    matchCondition(b.condition, {
      itemIds: new Set(),
      validityKind: proposal.validity.kind,
    }),
  );
  if (validityBlock) {
    const vars = buildVars(proposal, null, 1, '');
    for (const p of validityBlock.paragraphs) {
      const { text, unresolved } = resolveVars(p, vars);
      allUnresolvedVars.push(...unresolved);
      docBlocks.push({ type: 'paragraph', text });
    }
  }

  // Pricing tables per option
  let tableNum = 0;
  const footnoteMarks = ['*', '**', '***', '****'];
  for (const option of proposal.options) {
    const enabled = option.configurations.some((c) => c.enabled);
    if (!enabled && !(option.calculation?.items.length)) continue;
    tableNum += 1;
    const marker = footnoteMarks[tableNum - 1] ?? `*${tableNum}`;
    const itemIds = optionItemIds(option);
    const vars = buildVars(proposal, option, tableNum, marker);

    // Calc heading from quantities
    const pamCfg = option.configurations.find((c) => c.enabled && c.product === 'PAM');
    if (pamCfg) {
      const certLabel =
        pamCfg.certified === true
          ? ' сертифицированная версия'
          : pamCfg.certified === false
            ? ' обычная версия'
            : '';
      docBlocks.push({
        type: 'paragraph',
        text: `Расчет стоимости Indeed PAM на ${pamCfg.quantity} ${pamCfg.metric === 'concurrent_sessions' ? 'одновременных подключений' : 'пользователей'}${certLabel}:`,
        emphasis: 'normal',
      });
    }

    const tableTitleBlock = blocks.find((b) => {
      if (b.section !== 'pricing') return false;
      return matchCondition(b.condition, {
        itemIds,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
      });
    });
    let tableTitle = `Таблица ${tableNum}`;
    if (tableTitleBlock) {
      const { text, unresolved } = resolveVars(tableTitleBlock.paragraphs[0], vars);
      allUnresolvedVars.push(...unresolved);
      tableTitle = text;
    }
    // Title once as heading; do not also set table.title (docxExporter would duplicate it).
    docBlocks.push({ type: 'heading', level: 2, text: tableTitle });

    const lines = option.calculation?.items ?? [];
    const tbl = tableRows(lines);
    tbl.optionId = option.id;

    // Total row
    const amount = option.calculation?.totals.amount;
    const known = option.calculation?.totals.knownSubtotal;
    // KP layout (kp2705/kp2699): «Итого» in column 4, amount in column 6.
    if (option.calculation?.status === 'complete' && amount != null) {
      tbl.rows.push({
        cells: ['', '', '', 'Итого', '', formatMoneyPlain(amount)],
        isTotal: true,
      });
    } else if (known != null) {
      tbl.rows.push({
        cells: ['', '', '', 'Частичная сумма', '', formatMoneyPlain(known)],
        isTotal: true,
      });
      unresolvedNotes.push(`Альтернатива «${option.label}»: итог неполный — есть строки без цены`);
    }

    // Footnote license note
    const licenseNote = blocks.find((b) => {
      if (b.section !== 'license_note') return false;
      return matchCondition(b.condition, {
        itemIds,
        licenseType: option.licenseType,
        termMonths: option.termMonths,
      });
    });
    if (licenseNote) {
      const { text, unresolved } = resolveVars(licenseNote.paragraphs[0], vars);
      allUnresolvedVars.push(...unresolved);
      tbl.footnote = text;
    }
    docBlocks.push(tbl);

    // Kit VAT note for this option
    if (itemIds.has('PAM.FSTEC_KIT')) {
      const vatBlock = blocks.find((b) => b.id === 'pam.fstec.vat');
      if (vatBlock) {
        // Use editorial paragraphs — replace words version
        const editorial = `${marker}Сертифицированный ФСТЭК комплект облагается НДС ${vars['kit.vat_rate_percent']}% — ${vars['kit.vat_amount_formatted']} руб.`;
        docBlocks.push({ type: 'note', text: editorial });
      }
      const contents = blocks.find((b) => b.id === 'pam.fstec.contents');
      if (contents) {
        const { text: head } = resolveVars(contents.paragraphs[0], vars);
        docBlocks.push({ type: 'paragraph', text: head });
        docBlocks.push({
          type: 'list',
          ordered: false,
          items: contents.paragraphs.slice(1).map((p) => resolveVars(p, vars).text),
        });
      }
    }
  }

  // Licensing / descriptions based on union of items
  const allItemIds = new Set<string>();
  const metricsByProduct = new Map<string, Set<string>>();
  for (const option of proposal.options) {
    for (const id of optionItemIds(option)) allItemIds.add(id);
    for (const c of option.configurations.filter((x) => x.enabled)) {
      if (!metricsByProduct.has(c.product)) metricsByProduct.set(c.product, new Set());
      metricsByProduct.get(c.product)!.add(c.metric);
    }
  }

  for (const b of blocks) {
    if (!['licensing', 'description'].includes(b.section)) continue;
    // Prefer product+metric or has_item
    for (const [product, metrics] of metricsByProduct) {
      for (const metric of metrics) {
        if (
          matchCondition(b.condition, {
            product,
            metric,
            itemIds: allItemIds,
          })
        ) {
          // Avoid duplicate by id
          if (docBlocks.some((d) => d.type === 'heading' && d.text === b.title)) continue;
          if (b.paragraphs.length >= 2 && b.section === 'description') {
            docBlocks.push({ type: 'heading', level: 3, text: b.paragraphs[0] });
            for (const p of b.paragraphs.slice(1)) {
              docBlocks.push({ type: 'paragraph', text: p });
            }
          } else {
            for (const p of b.paragraphs) {
              docBlocks.push({ type: 'paragraph', text: p });
            }
          }
        }
      }
    }
    // has_item only blocks
    if (b.condition.has_item && matchCondition(b.condition, { itemIds: allItemIds })) {
      if (docBlocks.some((d) => d.type === 'paragraph' && d.text === b.paragraphs[0])) continue;
      if (b.section === 'description' && b.paragraphs.length >= 2) {
        docBlocks.push({ type: 'heading', level: 3, text: b.paragraphs[0] });
        for (const p of b.paragraphs.slice(1)) docBlocks.push({ type: 'paragraph', text: p });
      } else {
        for (const p of b.paragraphs) docBlocks.push({ type: 'paragraph', text: p });
      }
    }
  }

  // Warranty once
  const warranty = blocks.find((b) => b.id === 'common.warranty');
  if (warranty) {
    docBlocks.push({ type: 'heading', level: 3, text: 'Гарантийное обслуживание' });
    docBlocks.push({
      type: 'list',
      ordered: false,
      items: warranty.paragraphs.slice(1).map((p) =>
        p
          .replace('8 800 333-09-06', supplier.supportPhone)
          .replace('https://support.indeed-company.ru/', supplier.supportUrl),
      ),
    });
  }

  // Signature
  const sig = blocks.find((b) => b.id === 'common.signature');
  if (sig) {
    const vars = buildVars(proposal, null, 1, '');
    docBlocks.push({
      type: 'signature',
      lines: sig.paragraphs.map((p) => resolveVars(p, vars).text),
    });
  }

  // Unresolved SKUs / prices
  for (const option of proposal.options) {
    for (const line of option.calculation?.items ?? []) {
      if (line.skuStatus === 'unresolved') {
        unresolvedNotes.push(`Артикул не уточнён: ${line.description}`);
      }
      if (line.lineTotal == null) {
        unresolvedNotes.push(`Цена требует уточнения: ${line.description}`);
      }
    }
  }

  if (allUnresolvedVars.length) {
    unresolvedNotes.push(`Неразрешённые переменные: ${[...new Set(allUnresolvedVars)].join(', ')}`);
  }

  const safeNumber = (proposal.number || 'draft').replace(/[^\wа-яА-ЯёЁ-]+/gi, '_');
  return {
    fileBaseName: `DEMO_${safeNumber}`,
    isDemo: true,
    unresolvedNotes: [...new Set(unresolvedNotes)],
    blocks: docBlocks,
  };
}

export function describeStructure(proposal: Proposal): Array<{
  num: number;
  title: string;
  detail: string;
  status?: 'on' | 'warn';
}> {
  const doc = buildProposalDocument(proposal);
  const hasKit = proposal.options.some((o) =>
    o.configurations.some((c) => c.enabled && c.kitQuantity > 0),
  );
  const products = [
    ...new Set(
      proposal.options.flatMap((o) =>
        o.configurations.filter((c) => c.enabled).map((c) => PRODUCT_NAMES[c.product]),
      ),
    ),
  ];
  const sections: Array<{ num: number; title: string; detail: string; status?: 'on' | 'warn' }> = [
    {
      num: 1,
      title: 'Коммерческое предложение',
      detail: `Вводный текст, заказчик, номер КП, дата и срок действия.`,
      status: 'on',
    },
    {
      num: 2,
      title: 'Расчёт стоимости',
      detail: proposal.options.map((o, i) => `Таблица ${i + 1} — ${o.label}`).join('; '),
      status: 'on',
    },
  ];
  if (hasKit) {
    sections.push({
      num: 3,
      title: 'ФСТЭК-комплект',
      detail: 'Отдельная строка; НДС в примечании.',
      status: 'on',
    });
  }
  sections.push({
    num: sections.length + 1,
    title: 'Описание продуктов',
    detail: products.length ? products.join(', ') : 'Нет выбранных продуктов',
    status: products.length ? 'on' : 'warn',
  });
  sections.push({
    num: sections.length + 1,
    title: 'Гарантийное обслуживание и подпись',
    detail: 'Стандартный блок поддержки и подпись из демо-профиля поставщика.',
    status: 'on',
  });
  if (doc.unresolvedNotes.length) {
    sections.push({
      num: sections.length + 1,
      title: 'Незавершённые данные',
      detail: `${doc.unresolvedNotes.length} замечаний к демонстрационному черновику`,
      status: 'warn',
    });
  }
  return sections;
}
