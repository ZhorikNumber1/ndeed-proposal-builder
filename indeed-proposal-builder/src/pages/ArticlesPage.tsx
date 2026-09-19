import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import importReport from '../data/articlesImportReport.json';

interface CatalogEntry {
  sku?: string;
  label?: string;
  product?: string;
  [key: string]: unknown;
}

interface ArticlesCatalog {
  catalogVersion: string | null;
  source: string | null;
  entries: CatalogEntry[];
  importStatus: string;
}

const PAGE_SIZE = 50;

async function loadCatalog(): Promise<ArticlesCatalog> {
  const mod = await import('../data/articlesCatalog.json');
  return mod.default as ArticlesCatalog;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ArticlesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ArticlesCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void loadCatalog().then((c) => {
      setCatalog(c);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const isEmpty = !catalog || catalog.importStatus === 'missing_source' || catalog.entries.length === 0;

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.entries.filter((e) => {
      if (productFilter !== 'all' && e.product !== productFilter) return false;
      if (!q) return true;
      const hay = `${e.sku ?? ''} ${e.label ?? ''} ${e.product ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, search, productFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const handleCopy = useCallback(async (text: string) => {
    const ok = await copyText(text);
    setToast(ok ? 'Скопировано' : 'Не удалось скопировать в буфер обмена');
  }, []);

  const useInKp = useCallback(() => {
    const sku = selected?.sku ?? searchParams.get('sku') ?? '';
    navigate(`/?useArticle=${encodeURIComponent(String(sku))}`);
  }, [navigate, selected, searchParams]);

  return (
    <AppShell title="Артикулы" activeNav="articles">
      <div className="page-content">
        <header className="page-header">
          <h1 className="page-title">Артикулы</h1>
          <p className="page-subtitle">Справочник артикулов для подбора позиций в коммерческих предложениях.</p>
        </header>

        <div className="page-card">
          <h2>Источник данных</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Версия каталога: {catalog?.catalogVersion ?? '—'} · Файл: {catalog?.source ?? '—'} · Статус:{' '}
            {catalog?.importStatus ?? 'загрузка…'}
          </p>
          <p className="page-subtitle" style={{ marginTop: 8 }}>
            {importReport.message}
          </p>
        </div>

        {loading ? (
          <p className="page-subtitle">Загрузка каталога…</p>
        ) : isEmpty ? (
          <div className="page-card">
            <div className="empty-state">
              <strong>Справочник ещё не импортирован из Excel</strong>
              <p>Каталог пуст. После импорта здесь появятся артикулы с поиском и фильтрами.</p>
              <Link to="/" className="page-btn primary" style={{ marginTop: 16 }}>
                На главную
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="articles-filters">
              <input
                type="search"
                placeholder="Поиск по SKU, названию…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                aria-label="Поиск артикулов"
              />
              <select
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  setPage(0);
                }}
                aria-label="Фильтр по продукту"
              >
                <option value="all">Все продукты</option>
                <option value="AM">AM</option>
                <option value="CM">CM</option>
                <option value="PAM">PAM</option>
                <option value="ITDR">ITDR</option>
              </select>
            </div>

            <div className="articles-table-wrap">
              <table className="articles-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Название</th>
                    <th>Продукт</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry, idx) => (
                    <tr key={`${entry.sku ?? idx}-${idx}`}>
                      <td>{entry.sku ?? '—'}</td>
                      <td>{entry.label ?? '—'}</td>
                      <td>{entry.product ?? '—'}</td>
                      <td>
                        <button type="button" className="page-btn small" onClick={() => setSelected(entry)}>
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="articles-pagination">
              <span>
                Показано {pageItems.length} из {filtered.length} (стр. {page + 1} / {pageCount})
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="page-btn small"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Назад
                </button>
                <button
                  type="button"
                  className="page-btn small"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="drawer-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Артикул</h3>
            <div className="drawer-field">
              <label>SKU</label>
              <div>{selected.sku ?? '—'}</div>
            </div>
            <div className="drawer-field">
              <label>Название</label>
              <div>{selected.label ?? '—'}</div>
            </div>
            <div className="drawer-field">
              <label>Продукт</label>
              <div>{selected.product ?? '—'}</div>
            </div>
            <div className="drawer-actions">
              <button
                type="button"
                className="page-btn small"
                onClick={() => void handleCopy(String(selected.sku ?? ''))}
              >
                Копировать SKU
              </button>
              <button
                type="button"
                className="page-btn small"
                onClick={() => void handleCopy(String(selected.label ?? ''))}
              >
                Копировать название
              </button>
              <button type="button" className="page-btn small primary" onClick={useInKp}>
                Использовать в КП
              </button>
              <button type="button" className="page-btn small ghost" onClick={() => setSelected(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </AppShell>
  );
}
