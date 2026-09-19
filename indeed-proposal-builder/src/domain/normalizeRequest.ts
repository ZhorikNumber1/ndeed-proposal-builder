import type {
  Configuration,
  LicenseType,
  Metric,
  ModuleSelection,
  ParseCandidate,
  ParseToken,
  ProductCode,
} from './types';

let tokenSeq = 0;
function tid(): string {
  tokenSeq += 1;
  return `tok-${tokenSeq}`;
}

const MODULE_ALIASES: Array<{ patterns: RegExp[]; itemId: string; product?: ProductCode }> = [
  { patterns: [/\bwindows\s*logon\b/i, /\bwl\b/i], itemId: 'AM.WINDOWS_LOGON', product: 'AM' },
  { patterns: [/\blinux\s*logon\b/i, /\bll\b/i], itemId: 'AM.LINUX_LOGON', product: 'AM' },
  { patterns: [/\brdp\s*(windows\s*)?logon\b/i, /\brdp\b/i], itemId: 'AM.RDP_LOGON', product: 'AM' },
  { patterns: [/\bldap(\s*proxy)?\b/i], itemId: 'AM.LDAP_PROXY', product: 'AM' },
  { patterns: [/\benterprise\s*sso\b/i, /\besso\b/i, /\bsso\b/i], itemId: 'AM.ESSO', product: 'AM' },
  { patterns: [/\bnps\s*radius\b/i, /\bradius\b/i], itemId: 'AM.NPS_RADIUS', product: 'AM' },
  { patterns: [/\bfreeradius\b/i, /\bfree\s*radius\b/i], itemId: 'AM.FREERADIUS', product: 'AM' },
  { patterns: [/\bidp\b/i, /\bidentity\s*provider\b/i], itemId: 'AM.IDP', product: 'AM' },
  { patterns: [/\badfs\b/i], itemId: 'AM.ADFS', product: 'AM' },
  { patterns: [/\biis\b/i], itemId: 'AM.IIS', product: 'AM' },
  { patterns: [/\bmdp\b/i], itemId: 'AM.MDP', product: 'AM' },
  { patterns: [/\bapi\b/i], itemId: 'AM.API', product: 'AM' },
  { patterns: [/\baapm\b/i], itemId: 'PAM.AAPM', product: 'PAM' },
  { patterns: [/\bsql\s*proxy\b/i], itemId: 'PAM.SQL_PROXY', product: 'PAM' },
  { patterns: [/\bcm\s*agent\b/i, /\bagent\b/i], itemId: 'CM.WINDOWS.AGENT', product: 'CM' },
  { patterns: [/\bmfa\b/i], itemId: 'ITDR.MFA', product: 'ITDR' },
  { patterns: [/\bmonitoring\b/i], itemId: 'ITDR.MONITORING', product: 'ITDR' },
];

function normalize(raw: string): string {
  return raw
    .replace(/[–—]/g, '-')
    .replace(/[,;|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectNegatedCertification(text: string): boolean {
  return /(?:не\s+фстэк|без\s+фстэк|не\s+fstec|без\s+fstec|обычная\s+версия)/i.test(text);
}

function detectPositiveCertification(text: string): boolean {
  if (detectNegatedCertification(text)) return false;
  // "стек" alone is NOT FSTEC
  return /фстэк|fstec/i.test(text);
}

function extractTermMonths(text: string): { months: number | null; rest: string } {
  let months: number | null = null;
  let rest = text;
  const patterns: Array<[RegExp, number]> = [
    [/\bна\s+год\b/i, 12],
    [/\b12\s*months?\b/i, 12],
    [/\b12\s*мес(?:яц(?:а|ев)?)?/i, 12],
    [/\b6\s*мес(?:яц(?:а|ев)?)?/i, 6],
    [/\b24\s*мес(?:яц(?:а|ев)?)?/i, 24],
    [/\b36\s*мес(?:яц(?:а|ев)?)?/i, 36],
  ];
  for (const [re, value] of patterns) {
    if (re.test(rest)) {
      months = value;
      rest = rest.replace(re, ' ');
      break;
    }
  }
  return { months, rest: normalize(rest) };
}

export function normalizeRequest(rawInput: string): ParseCandidate {
  tokenSeq = 0;
  const raw = rawInput.trim();
  const tokens: ParseToken[] = [];
  const conflicts: string[] = [];
  const questions: string[] = [];
  const unrecognized: string[] = [];
  const modules: ParseCandidate['modules'] = [];
  const products: ParseCandidate['products'] = [];

  if (!raw) {
    return {
      raw,
      tokens,
      products,
      modules,
      conflicts,
      unrecognized,
      questions,
      termMonths: null,
      licenseType: null,
    };
  }

  let text = normalize(raw);
  const { months: termMonths, rest: afterTerm } = extractTermMonths(text);
  text = afterTerm;

  let certified: boolean | null = null;
  if (detectNegatedCertification(text)) {
    certified = false;
    tokens.push({ id: tid(), kind: 'certification', label: 'обычная версия', value: false, confirmed: false });
    text = text.replace(/(?:не\s+фстэк|без\s+фстэк|не\s+fstec|без\s+fstec|обычная\s+версия)/gi, ' ');
  } else if (detectPositiveCertification(text)) {
    certified = true;
    tokens.push({ id: tid(), kind: 'certification', label: 'ФСТЭК', value: true, confirmed: false });
    text = text.replace(/фстэк|fstec/gi, ' ');
  }

  let licenseType: LicenseType | null = null;
  if (/бессрочн/i.test(text)) {
    licenseType = 'perpetual';
    tokens.push({ id: tid(), kind: 'licenseType', label: 'бессрочная', value: 'perpetual', confirmed: false });
    text = text.replace(/бессрочн\w*/gi, ' ');
  } else if (/подписк/i.test(text)) {
    licenseType = 'subscription';
    tokens.push({ id: tid(), kind: 'licenseType', label: 'подписка', value: 'subscription', confirmed: false });
    text = text.replace(/подписк\w*/gi, ' ');
  }
  if (termMonths != null) {
    tokens.push({
      id: tid(),
      kind: 'term',
      label: `${termMonths} мес.`,
      value: termMonths,
      confirmed: false,
    });
    if (!licenseType) licenseType = 'subscription';
  }

  // Module detection (before numbers so "AAPM 50" works)
  const foundModuleIds = new Set<string>();
  for (const alias of MODULE_ALIASES) {
    for (const pat of alias.patterns) {
      if (pat.test(text) && !foundModuleIds.has(alias.itemId)) {
        // Don't treat NPS RADIUS as FreeRADIUS
        if (alias.itemId === 'AM.NPS_RADIUS' && /freeradius|free\s*radius/i.test(text) && !/nps/i.test(text)) {
          continue;
        }
        if (alias.itemId === 'AM.NPS_RADIUS' && /freeradius/i.test(text) && !/\bnps\b/i.test(text) && !/\bradius\b/i.test(text.replace(/freeradius/gi, ''))) {
          continue;
        }
        foundModuleIds.add(alias.itemId);
        tokens.push({
          id: tid(),
          kind: 'module',
          label: alias.itemId.split('.').pop() ?? alias.itemId,
          value: alias.itemId,
          confirmed: false,
        });
        text = text.replace(pat, ' ');
        break;
      }
    }
  }

  text = normalize(text);

  // Product codes
  const productHits: ProductCode[] = [];
  const productPatterns: Array<[RegExp, ProductCode]> = [
    [/\bitdr\b/i, 'ITDR'],
    [/\bpam\b/i, 'PAM'],
    [/\bam\b/i, 'AM'],
    [/\bcm\b/i, 'CM'],
  ];
  for (const [pat, code] of productPatterns) {
    if (pat.test(text)) {
      productHits.push(code);
      tokens.push({ id: tid(), kind: 'product', label: code, value: code, confirmed: false });
      text = text.replace(pat, ' ');
    }
  }

  // Compact forms like PAM25, PAM46
  const compact = raw.match(/\b(PAM|AM|CM|ITDR)\s*(\d{1,5})\b/i);
  // Metric hints
  let metric: Metric | null = null;
  let metricAmbiguous = false;
  if (/\bcs\b|одновременн/i.test(text) || /\bcs\b/i.test(raw)) {
    metric = 'concurrent_sessions';
    tokens.push({ id: tid(), kind: 'metric', label: 'CS', value: metric, confirmed: false });
    text = text.replace(/\bcs\b|одновременн[а-яёa-z]*/gi, ' ');
  } else if (/\brl\b|ресурс/i.test(text)) {
    metric = 'resources';
    tokens.push({ id: tid(), kind: 'metric', label: 'RL', value: metric, confirmed: false });
    text = text.replace(/\brl\b|ресурс[а-яёa-z]*/gi, ' ');
  } else if (/пользовател/i.test(text) || /\bul\b/i.test(text)) {
    metric = 'users';
    tokens.push({ id: tid(), kind: 'metric', label: 'UL', value: metric, confirmed: false });
    // Cyrillic stems: \w without /u does not match letters — use explicit Cyrillic class
    text = text.replace(/пользовател[а-яёa-z]*/gi, ' ').replace(/\bul\b/gi, ' ');
  }

  text = normalize(text);

  // Extract numbers (not term months already removed)
  const numbers: number[] = [];
  const numRe = /\b(\d{1,6})\b/g;
  let nm: RegExpExecArray | null;
  const work = normalize(text);
  while ((nm = numRe.exec(work)) !== null) {
    const n = Number(nm[1]);
    // skip if it was only part of already-handled compact — still collect
    if (n === termMonths) continue;
    numbers.push(n);
  }

  // Also from compact PAM25 / PAM46 (and strip leftover compact token from working text)
  if (compact) {
    const n = Number(compact[2]);
    if (!numbers.includes(n)) numbers.push(n);
    const productCode = compact[1].toUpperCase() as ProductCode;
    if (!productHits.includes(productCode)) {
      productHits.push(productCode);
      tokens.push({ id: tid(), kind: 'product', label: productCode, value: productCode, confirmed: false });
    }
    text = normalize(text.replace(new RegExp(`\\b${compact[1]}\\s*${compact[2]}\\b`, 'i'), ' '));
  }

  if (numbers.length > 1) {
    // Check if one is clearly module qty vs base — still conflict if two base candidates
    conflicts.push(`Неоднозначные числа: ${numbers.join(', ')}. Уточните, какое относится к количеству.`);
    tokens.push({
      id: tid(),
      kind: 'conflict',
      label: `числа ${numbers.join('/')}`,
      value: numbers,
      confirmed: false,
      ambiguous: true,
    });
  }

  let quantity: number | null = numbers.length === 1 ? numbers[0] : numbers.length > 1 ? null : null;
  if (numbers.length === 1) {
    tokens.push({
      id: tid(),
      kind: 'quantity',
      label: String(numbers[0]),
      value: numbers[0],
      confirmed: false,
    });
  }

  // AAPM-only without PAM base
  const onlyAapm =
    foundModuleIds.has('PAM.AAPM') &&
    !productHits.includes('PAM') &&
    productHits.length === 0;

  if (onlyAapm) {
    modules.push({
      itemId: 'PAM.AAPM',
      quantity,
      quantityInferred: false,
    });
    questions.push('Модуль AAPM распознан; базовая конфигурация PAM ещё не задана');
  }

  // Infer products from modules
  if (productHits.length === 0) {
    for (const alias of MODULE_ALIASES) {
      if (foundModuleIds.has(alias.itemId) && alias.product && !productHits.includes(alias.product)) {
        if (alias.itemId === 'PAM.AAPM' && onlyAapm) continue;
        productHits.push(alias.product);
      }
    }
  }

  // Default metric for PAM when number without metric
  if (productHits.includes('PAM') && metric == null && quantity != null) {
    metric = 'users';
    metricAmbiguous = true;
    questions.push('Для PAM без явной метрики предложен UL — при необходимости смените на CS/RL');
    tokens.push({
      id: tid(),
      kind: 'metric',
      label: 'UL (предложение)',
      value: 'users',
      confirmed: false,
      ambiguous: true,
    });
  }

  for (const code of productHits) {
    const productModules = [...foundModuleIds]
      .filter((id) => {
        if (code === 'AM') return id.startsWith('AM.');
        if (code === 'CM') return id.startsWith('CM.');
        if (code === 'PAM') return id.startsWith('PAM.') && id !== 'PAM.FSTEC_KIT';
        if (code === 'ITDR') return id.startsWith('ITDR.');
        return false;
      })
      .map((itemId) => ({
        itemId,
        quantity: quantity,
        quantityInferred: quantity != null && !/mfa|monitoring|aapm/i.test(itemId) ? true : quantity != null,
      }));

    // ITDR: Monitoring and MFA
    if (code === 'ITDR') {
      for (const id of ['ITDR.MONITORING', 'ITDR.MFA']) {
        if (foundModuleIds.has(id) && !productModules.some((m) => m.itemId === id)) {
          productModules.push({ itemId: id, quantity, quantityInferred: true });
        }
      }
    }

    // CM agent
    if (code === 'CM' && foundModuleIds.has('CM.WINDOWS.AGENT')) {
      // platform needs clarification if agent mentioned without platform
      questions.push('Платформа CM требует уточнения (Windows / Мультиплатформа)');
    }

    const partial: Partial<Configuration> & { product: ProductCode } = {
      product: code,
      metric:
        code === 'PAM'
          ? metric ?? 'users'
          : code === 'ITDR'
            ? 'licensed_units'
            : 'users',
      quantity: quantity ?? undefined,
      certified: code === 'PAM' ? certified : certified === true ? true : null,
      kitQuantity: code === 'PAM' && certified === true ? 1 : 0,
      platform: code === 'CM' ? null : null,
      enabled: true,
      modules: productModules.map((m, i) => {
        const metric: Metric =
          m.itemId === 'PAM.AAPM'
            ? 'service_accounts'
            : m.itemId.startsWith('ITDR')
              ? 'licensed_units'
              : 'users';
        const mod: ModuleSelection = {
          id: `mod-cand-${i}`,
          itemId: m.itemId,
          metric,
          quantity: m.quantity ?? 0,
        };
        return mod;
      }),
    };

    if (metricAmbiguous && code === 'PAM') {
      questions.push('Метрику PAM можно изменить');
    }
    if (productModules.some((m) => m.quantityInferred)) {
      questions.push('Количество модулей подставлено из базы — измените при необходимости');
    }

    products.push(partial);
  }

  // Remaining unrecognized tokens
  // Strip filler Cyrillic prepositions without relying on \b/\w (ASCII-only in JS without /u)
  const leftover = normalize(text)
    .replace(/\b\d+\b/g, ' ')
    .replace(/(?:^|\s)(?:на|и|для|по|the|of)(?=\s|$)/gi, ' ');
  for (const part of leftover.split(/\s+/).filter(Boolean)) {
    if (/^(и|для|по|на|the|of)$/i.test(part)) continue;
    unrecognized.push(part);
    tokens.push({ id: tid(), kind: 'unknown', label: part, value: part, confirmed: false });
  }

  return {
    raw,
    tokens,
    products,
    modules: onlyAapm ? modules : modules,
    conflicts,
    unrecognized,
    questions,
    termMonths,
    licenseType,
  };
}

export function candidateToConfiguration(
  partial: Partial<Configuration> & { product: ProductCode },
  id: string,
): Configuration {
  return {
    id,
    product: partial.product,
    platform: partial.platform ?? null,
    metric: partial.metric ?? 'users',
    quantity: partial.quantity && partial.quantity > 0 ? partial.quantity : 0,
    certified: partial.certified ?? null,
    kitQuantity: partial.kitQuantity ?? 0,
    modules: (partial.modules ?? []).map((m, i) => ({
      ...m,
      id: m.id || `${id}-mod-${i}`,
      quantity: m.quantity > 0 ? m.quantity : partial.quantity ?? 0,
    })),
    enabled: partial.enabled ?? true,
  };
}
