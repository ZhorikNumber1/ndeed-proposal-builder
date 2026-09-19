import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { createDemoProposal } from '../data/demoProposal';
import type { DraftSummary } from '../domain/draftTypes';
import { draftCollectionRepository } from '../services/draftCollectionRepository';
import { formatDateRu } from '../domain/dates';

export function HomePage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await draftCollectionRepository.migrateLegacyIfNeeded();
    const list = await draftCollectionRepository.list();
    setDrafts(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.number.toLowerCase().includes(q) ||
        d.productsLabel.toLowerCase().includes(q),
    );
  }, [drafts, search]);

  const lastDraft = drafts[0] ?? null;

  const createDraft = async () => {
    try {
      const draft = await draftCollectionRepository.create();
      navigate(`/proposals/${draft.id}/edit`);
    } catch {
      setToast('Не удалось создать черновик');
    }
  };

  const openExample = async () => {
    try {
      const draft = await draftCollectionRepository.create(createDemoProposal(), 'Демо-пример', 2);
      navigate(`/proposals/${draft.id}/edit`);
    } catch {
      setToast('Не удалось открыть пример');
    }
  };

  const openDraft = (id: string) => {
    navigate(`/proposals/${id}/edit`);
  };

  const handleDuplicate = async (id: string) => {
    const copy = await draftCollectionRepository.duplicate(id);
    if (copy) {
      setToast('Копия создана');
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    await draftCollectionRepository.remove(id);
    setConfirmDeleteId(null);
    setToast('Черновик удалён');
    await refresh();
  };

  const handleRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    await draftCollectionRepository.updateTitle(renameId, renameValue.trim());
    setRenameId(null);
    setRenameValue('');
    setToast('Название обновлено');
    await refresh();
  };

  return (
    <AppShell title="Главная" activeNav="home">
      <div className="page-content">
        <header className="page-header">
          <h1 className="page-title">Главная</h1>
          <p className="page-subtitle">Создавайте и управляйте коммерческими предложениями локально в браузере.</p>
        </header>

        <div className="page-actions">
          <button type="button" className="page-btn primary" onClick={() => void createDraft()}>
            Создать КП
          </button>
          {lastDraft ? (
            <button type="button" className="page-btn" onClick={() => openDraft(lastDraft.id)}>
              Продолжить последнее
            </button>
          ) : null}
          <button type="button" className="page-btn ghost" onClick={() => void openExample()}>
            Открыть пример
          </button>
          <Link to="/articles" className="page-btn ghost">
            Артикулы
          </Link>
        </div>

        <div className="page-card">
          <h2>Мои черновики</h2>
          {loading ? (
            <p className="page-subtitle">Загрузка…</p>
          ) : drafts.length === 0 ? (
            <div className="empty-state">
              <strong>Черновиков пока нет</strong>
              <p>Нажмите «Создать КП», чтобы начать новое коммерческое предложение.</p>
            </div>
          ) : (
            <>
              <div className="drafts-toolbar">
                <input
                  type="search"
                  className="drafts-search"
                  placeholder="Поиск по названию, заказчику, номеру…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Поиск черновиков"
                />
              </div>
              <div className="drafts-list">
                {filtered.length === 0 ? (
                  <p className="page-subtitle">Ничего не найдено по запросу «{search}».</p>
                ) : (
                  filtered.map((d) => (
                    <div key={d.id} className="draft-row">
                      <div className="draft-row-main">
                        <div className="draft-row-title">{d.title}</div>
                        <div className="draft-row-meta">
                          {d.customerName} · {d.number} · шаг {d.activeStep} · {formatDateRu(d.updatedAt.slice(0, 10))}
                        </div>
                      </div>
                      <div className="draft-row-totals">
                        {d.optionTotals.map((t) => (
                          <div key={t.label}>
                            {t.label}: {t.amount ?? '—'}
                            {t.partial ? ' (частично)' : ''}
                          </div>
                        ))}
                      </div>
                      <div className="draft-row-actions">
                        <button type="button" className="page-btn small primary" onClick={() => openDraft(d.id)}>
                          Открыть
                        </button>
                        <button
                          type="button"
                          className="page-btn small"
                          onClick={() => {
                            setRenameId(d.id);
                            setRenameValue(d.title);
                          }}
                        >
                          Переименовать
                        </button>
                        <button type="button" className="page-btn small" onClick={() => void handleDuplicate(d.id)}>
                          Дублировать
                        </button>
                        <button type="button" className="page-btn small" onClick={() => setConfirmDeleteId(d.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <p className="page-note">
          Черновики сохраняются в localStorage этого браузера. Очистка данных сайта удалит несохранённые на сервере
          КП.
        </p>
      </div>

      {confirmDeleteId ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setConfirmDeleteId(null)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Удалить черновик?</h2>
            <p>Действие нельзя отменить.</p>
            <div className="dialog-actions">
              <button type="button" className="bottom-btn ghost" onClick={() => setConfirmDeleteId(null)}>
                Отмена
              </button>
              <button type="button" className="bottom-btn next" onClick={() => void handleDelete(confirmDeleteId)}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameId ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setRenameId(null)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Переименовать черновик</h2>
            <input
              className="drafts-search"
              style={{ width: '100%' }}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              aria-label="Новое название"
            />
            <div className="dialog-actions">
              <button type="button" className="bottom-btn ghost" onClick={() => setRenameId(null)}>
                Отмена
              </button>
              <button type="button" className="bottom-btn next" onClick={() => void handleRename()}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </AppShell>
  );
}
