import type { DraftRepository, StoredDraft } from '../domain/types';

export const DRAFT_STORAGE_KEY = 'indeed-proposal-builder:draft:v1';
export const SIDEBAR_STORAGE_KEY = 'indeed-proposal-builder:sidebar-collapsed';

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as StoredDraft;
  return v.schemaVersion === 1 && v.proposal != null && v.proposal.schemaVersion === 1;
}

export function createLocalDraftRepository(): DraftRepository {
  return {
    async load(): Promise<StoredDraft | null> {
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredDraft(parsed)) {
          console.warn('Draft schema unsupported or corrupt — ignored');
          return null;
        }
        return parsed;
      } catch (e) {
        console.warn('Failed to load draft', e);
        return null;
      }
    },
    async save(draft: StoredDraft): Promise<void> {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        throw new Error(`Не удалось сохранить черновик: ${err.message}`);
      }
    },
    async clear(): Promise<void> {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

export const localDraftRepository = createLocalDraftRepository();

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
