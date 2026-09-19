import type { Proposal, ProposalOption, StoredDraft } from '../domain/types';
import type { DraftEnvelope, DraftSaveResult, DraftSummary } from '../domain/draftTypes';
import { createEmptyProposal } from '../data/demoProposal';
import { calculateOptionSync } from '../domain/calculateOption';
import { formatMoney } from '../domain/money';
import { DRAFT_STORAGE_KEY as LEGACY_DRAFT_KEY } from './localDraftRepository';

export const DRAFT_INDEX_KEY = 'indeed-proposal-builder:drafts:index:v2';
export const DRAFT_ITEM_KEY_PREFIX = 'indeed-proposal-builder:drafts:item:v2:';
export const DRAFT_MIGRATED_KEY = 'indeed-proposal-builder:drafts:migrated:v2';

const LEGACY_MIGRATION_ID = 'legacy-v1-migrated';

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): DraftStorage {
  return localStorage;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as StoredDraft;
  return v.schemaVersion === 1 && v.proposal != null && v.proposal.schemaVersion === 1;
}

function isDraftEnvelope(value: unknown): value is DraftEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as DraftEnvelope;
  return v.storageVersion === 2 && typeof v.id === 'string' && v.proposal?.schemaVersion === 1;
}

function readIndex(storage: DraftStorage): string[] {
  try {
    const raw = storage.getItem(DRAFT_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function writeIndex(storage: DraftStorage, ids: string[]): void {
  storage.setItem(DRAFT_INDEX_KEY, JSON.stringify(ids));
}

function itemKey(id: string): string {
  return `${DRAFT_ITEM_KEY_PREFIX}${id}`;
}

function readEnvelope(storage: DraftStorage, id: string): DraftEnvelope | null {
  try {
    const raw = storage.getItem(itemKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftEnvelope(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEnvelope(storage: DraftStorage, draft: DraftEnvelope): void {
  storage.setItem(itemKey(draft.id), JSON.stringify(draft));
}

function statusLabel(proposal: Proposal): string {
  switch (proposal.status) {
    case 'ready_for_review':
      return 'Готово к проверке';
    case 'needs_rule':
      return 'Нужны правила';
    case 'needs_input':
      return 'Нужны данные';
    default:
      return 'Черновик';
  }
}

function productsLabel(proposal: Proposal): string {
  const products = new Set<string>();
  for (const opt of proposal.options) {
    for (const cfg of opt.configurations) {
      if (cfg.enabled) products.add(cfg.product);
    }
  }
  if (products.size === 0) return '—';
  return [...products].join(', ');
}

function optionTotals(proposal: Proposal): DraftSummary['optionTotals'] {
  return proposal.options.map((opt) => {
    const calc = opt.calculation;
    if (!calc) {
      return { label: opt.label, amount: null, partial: true };
    }
    if (calc.status === 'complete' && calc.totals.amount != null) {
      return { label: opt.label, amount: formatMoney(calc.totals.amount), partial: false };
    }
    if (calc.totals.knownSubtotal) {
      return { label: opt.label, amount: formatMoney(calc.totals.knownSubtotal), partial: true };
    }
    return { label: opt.label, amount: null, partial: true };
  });
}

function toSummary(draft: DraftEnvelope): DraftSummary {
  return {
    id: draft.id,
    title: draft.title,
    customerName: draft.proposal.customer.legalName || '—',
    number: draft.proposal.number || '—',
    productsLabel: productsLabel(draft.proposal),
    updatedAt: draft.updatedAt,
    activeStep: draft.builder.activeStep,
    statusLabel: statusLabel(draft.proposal),
    optionTotals: optionTotals(draft.proposal),
  };
}

function recalcProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    options: proposal.options.map((opt, idx) => ({
      ...opt,
      calculation: calculateOptionSync(opt, idx + 1),
    })),
    updatedAt: nowIso(),
  };
}

function cloneProposalDeep(proposal: Proposal): Proposal {
  const created = nowIso();
  return {
    ...proposal,
    id: uid('prop'),
    options: proposal.options.map((opt) => cloneOptionDeep(opt)),
    createdAt: created,
    updatedAt: created,
  };
}

function cloneOptionDeep(opt: ProposalOption): ProposalOption {
  return {
    ...opt,
    id: uid('opt'),
    configurations: opt.configurations.map((cfg) => ({
      ...cfg,
      id: uid('cfg'),
      modules: cfg.modules.map((m) => ({ ...m, id: uid('mod') })),
    })),
    calculation: null,
  };
}

function defaultTitle(proposal: Proposal): string {
  if (proposal.customer.legalName) return proposal.customer.legalName;
  if (proposal.number) return proposal.number;
  return 'Новое КП';
}

function envelopeFromLegacy(stored: StoredDraft, id: string): DraftEnvelope {
  const created = stored.savedAt || nowIso();
  const proposal = recalcProposal(stored.proposal);
  return {
    storageVersion: 2,
    id,
    title: defaultTitle(proposal),
    proposal,
    builder: {
      activeStep: stored.ui.activeStep,
      activeOptionId: stored.ui.activeOptionId || proposal.options[0]?.id || null,
    },
    revision: 1,
    createdAt: created,
    updatedAt: created,
    saveStatus: 'saved',
  };
}

function createEnvelope(proposal?: Proposal, title = 'Новое КП', activeStep: 1 | 2 | 3 | 4 = 1): DraftEnvelope {
  const created = nowIso();
  const base = recalcProposal(proposal ?? createEmptyProposal());
  return {
    storageVersion: 2,
    id: uid('draft'),
    title,
    proposal: base,
    builder: {
      activeStep,
      activeOptionId: base.options[0]?.id ?? null,
    },
    revision: 1,
    createdAt: created,
    updatedAt: created,
    saveStatus: 'saved',
  };
}

export function createDraftCollectionRepository(storage: DraftStorage = defaultStorage()) {
  return {
    async list(): Promise<DraftSummary[]> {
      const ids = readIndex(storage);
      const summaries: DraftSummary[] = [];
      for (const id of ids) {
        const draft = readEnvelope(storage, id);
        if (draft) summaries.push(toSummary(draft));
      }
      summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return summaries;
    },

    async get(id: string): Promise<DraftEnvelope | null> {
      return readEnvelope(storage, id);
    },

    async create(proposal?: Proposal, title = 'Новое КП', activeStep: 1 | 2 | 3 | 4 = 1): Promise<DraftEnvelope> {
      const draft = createEnvelope(proposal, title, activeStep);
      const ids = readIndex(storage);
      ids.unshift(draft.id);
      writeIndex(storage, ids);
      writeEnvelope(storage, draft);
      return draft;
    },

    async save(draft: DraftEnvelope, expectedRevision: number): Promise<DraftSaveResult> {
      const stored = readEnvelope(storage, draft.id);
      if (stored && stored.revision > expectedRevision) {
        return { ok: false, conflict: true, stored };
      }
      const next: DraftEnvelope = {
        ...draft,
        revision: (stored?.revision ?? expectedRevision) + 1,
        updatedAt: nowIso(),
        saveStatus: 'saved',
      };
      writeEnvelope(storage, next);
      const ids = readIndex(storage);
      if (!ids.includes(draft.id)) {
        ids.unshift(draft.id);
        writeIndex(storage, ids);
      }
      if (storage.getItem(LEGACY_DRAFT_KEY) && storage.getItem(DRAFT_MIGRATED_KEY)) {
        storage.removeItem(LEGACY_DRAFT_KEY);
      }
      return { ok: true, draft: next };
    },

    async duplicate(id: string): Promise<DraftEnvelope | null> {
      const source = readEnvelope(storage, id);
      if (!source) return null;
      const created = nowIso();
      const proposal = recalcProposal(cloneProposalDeep(source.proposal));
      const draft: DraftEnvelope = {
        storageVersion: 2,
        id: uid('draft'),
        title: `${source.title} (копия)`,
        proposal,
        builder: { ...source.builder, activeOptionId: proposal.options[0]?.id ?? null },
        revision: 1,
        createdAt: created,
        updatedAt: created,
        saveStatus: 'saved',
      };
      const ids = readIndex(storage);
      ids.unshift(draft.id);
      writeIndex(storage, ids);
      writeEnvelope(storage, draft);
      return draft;
    },

    async remove(id: string): Promise<void> {
      storage.removeItem(itemKey(id));
      writeIndex(storage, readIndex(storage).filter((x) => x !== id));
    },

    async updateTitle(id: string, title: string): Promise<DraftEnvelope | null> {
      const draft = readEnvelope(storage, id);
      if (!draft) return null;
      const next = { ...draft, title, updatedAt: nowIso() };
      writeEnvelope(storage, next);
      return next;
    },

    async migrateLegacyIfNeeded(): Promise<void> {
      const migrated = storage.getItem(DRAFT_MIGRATED_KEY);
      if (migrated) return;

      const existingLegacy = readEnvelope(storage, LEGACY_MIGRATION_ID);
      if (existingLegacy) {
        storage.setItem(DRAFT_MIGRATED_KEY, LEGACY_MIGRATION_ID);
        return;
      }

      const raw = storage.getItem(LEGACY_DRAFT_KEY);
      if (!raw) {
        storage.setItem(DRAFT_MIGRATED_KEY, 'none');
        return;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredDraft(parsed)) {
          storage.setItem(DRAFT_MIGRATED_KEY, 'none');
          return;
        }
        const draft = envelopeFromLegacy(parsed, LEGACY_MIGRATION_ID);
        const ids = readIndex(storage);
        if (!ids.includes(draft.id)) {
          ids.unshift(draft.id);
          writeIndex(storage, ids);
        }
        writeEnvelope(storage, draft);
        storage.setItem(DRAFT_MIGRATED_KEY, LEGACY_MIGRATION_ID);
      } catch {
        storage.setItem(DRAFT_MIGRATED_KEY, 'none');
      }
    },

    /** Test helper — clears only collection keys in the given storage. */
    _resetCollectionKeys(): void {
      const ids = readIndex(storage);
      for (const id of ids) storage.removeItem(itemKey(id));
      storage.removeItem(DRAFT_INDEX_KEY);
      storage.removeItem(DRAFT_MIGRATED_KEY);
    },
  };
}

export const draftCollectionRepository = createDraftCollectionRepository();
