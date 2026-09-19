import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProposal } from '../data/demoProposal';
import {
  createDraftCollectionRepository,
  DRAFT_INDEX_KEY,
  DRAFT_ITEM_KEY_PREFIX,
  DRAFT_MIGRATED_KEY,
} from '../services/draftCollectionRepository';
import { DRAFT_STORAGE_KEY } from '../services/localDraftRepository';
import type { StoredDraft } from '../domain/types';

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
  };
}

function legacyDraft(): StoredDraft {
  const proposal = createDemoProposal();
  return {
    schemaVersion: 1,
    savedAt: '2026-01-15T10:00:00.000Z',
    proposal,
    ui: { activeStep: 2, activeOptionId: proposal.options[0].id, sidebarCollapsed: false },
  };
}

describe('draftCollectionRepository', () => {
  let storage: Storage;
  let repo: ReturnType<typeof createDraftCollectionRepository>;

  beforeEach(() => {
    storage = makeMemoryStorage();
    repo = createDraftCollectionRepository(storage);
  });

  it('migrates legacy draft once without duplicating', async () => {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(legacyDraft()));
    await repo.migrateLegacyIfNeeded();
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(storage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(DRAFT_MIGRATED_KEY)).toBeTruthy();

    await repo.migrateLegacyIfNeeded();
    const list2 = await repo.list();
    expect(list2).toHaveLength(1);
  });

  it('creates two independent drafts', async () => {
    const a = await repo.create();
    const b = await repo.create();
    expect(a.id).not.toBe(b.id);
    const list = await repo.list();
    expect(list).toHaveLength(2);
    a.proposal.number = 'КП-A';
    await repo.save(a, a.revision);
    const loadedB = await repo.get(b.id);
    expect(loadedB?.proposal.number).toBe('');
  });

  it('duplicates with new proposal and option ids', async () => {
    const source = await repo.create(createDemoProposal(), 'Исходник');
    const copy = await repo.duplicate(source.id);
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(source.id);
    expect(copy!.proposal.id).not.toBe(source.proposal.id);
    expect(copy!.proposal.options[0].id).not.toBe(source.proposal.options[0].id);
    expect(copy!.title).toContain('копия');
  });

  it('returns conflict when stored revision is newer', async () => {
    const draft = await repo.create();
    const firstSave = await repo.save(
      { ...draft, proposal: { ...draft.proposal, number: 'v1' } },
      draft.revision,
    );
    expect(firstSave.ok).toBe(true);
    if (!firstSave.ok) return;

    const stale = { ...firstSave.draft, proposal: { ...firstSave.draft.proposal, number: 'stale' } };
    const conflict = await repo.save(stale, draft.revision);
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.stored.proposal.number).toBe('v1');

    const loaded = await repo.get(draft.id);
    expect(loaded?.proposal.number).toBe('v1');
  });

  it('isolates corrupt item entries', async () => {
    const good = await repo.create();
    storage.setItem(`${DRAFT_ITEM_KEY_PREFIX}bad`, '{not-json');
    storage.setItem(DRAFT_INDEX_KEY, JSON.stringify([good.id, 'bad']));
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(good.id);
  });
});
