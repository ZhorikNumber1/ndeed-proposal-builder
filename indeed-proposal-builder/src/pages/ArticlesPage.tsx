import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import importReport from '../data/articlesImportReport.json';
import type { ArticleEntry, ArticlesCatalogFile, ArticlesImportReport } from '../domain/articleTypes';

const PAGE_SIZE = 50;
const report = importReport as ArticlesImportReport;

async function loadCatalog(): Promise<ArticlesCatalogFile> {
  const mod = await import('../data/articlesCatalog.json');
  return mod.default as ArticlesCatalogFile;
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

function formatSource(entry: ArticleEntry): string {
  return entry.sources.map((s) => `${s.sheet}!${s.cell}`).join(', ');
}

export function ArticlesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ArticlesCatalogFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [certificationFilter, setCertificationFilter] = useState('all');
  const [showSpecial, setShowSpecial] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ArticleEntry | null>(null);
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

  const kindOptions = useMemo(() => {
    if (!catalog) return [];
    const kinds = new Set(catalog.entries.map((e) => e.kind));
    return [...kinds].sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.entries.filter((e) => {
      if (!showSpecial && (e.excludedByDefault || e.kind === 'special' || e.kind === 'one_off')) {
        return false;
      }
      if (productFilter !== 'all' && e.product !== productFilter) return false;
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (certificationFilter === 'ordinary' && e.certification !== 'ordinary') return false;
      if (certificationFilter === 'fstec' && e.certification !== 'fstec') return false;
      if (certificationFilter === 'none' && e.certification != null) return false;
      if (!q) return true;
      const hay = `${e.sku} ${e.name} ${e.product} ${e.itemId ?? ''} ${e.kind}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, search, productFilter, kindFilter, certificationFilter, showSpecial]);

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

  const sourceLabel = catalog?.source
    ? `${catalog.source.fileName} (${catalog.source.fileHash.slice(0, 8)}…)`
    : '—';

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
            Версия каталога: {catalog?.catalogVersion ?? '—'} · Файл: {sourceLabel} · Статус:{' '}
            {catalog?.importStatus ?? 'загрузка…'}
          </p>
          <p className="page-subtitle" style={{ marginTop: 8 }}>
            {report.message}
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
              <select
                value={kindFilter}
                onChange={(e) => {
                  setKindFilter(e.target.value);
                  setPage(0);
                }}
                aria-label="Фильтр по типу"
              >
                <option value="all">Все типы</option>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
              <select
                value={certificationFilter}
                onChange={(e) => {
                  setCertificationFilter(e.target.value);
                  setPage(0);
                }}
                aria-label="Фильтр по сертификации"
              >
                <option value="all">Любая сертификация</option>
                <option value="ordinary">Обычная</option>
                <option value="fstec">ФСТЭК</option>
                <option value="none">Без сертификации</option>
              </select>
              <label className="articles-toggle">
                <input
                  type="checkbox"
                  checked={showSpecial}
                  onChange={(e) => {
                    setShowSpecial(e.target.checked);
                    setPage(0);
                  }}
                />
                Показать special / one-off
              </label>
            </div>

            <div className="articles-table-wrap">
              <table className="articles-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Название</th>
                    <th>Продукт</th>
                    <th>Тип</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.sku}</td>
                      <td>{entry.name}</td>
                      <td>{entry.product}</td>
                      <td>{entry.kind}</td>
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
              <div>{selected.sku}</div>
            </div>
            <div className="drawer-field">
              <label>Название</label>
              <div>{selected.name}</div>
            </div>
            <div className="drawer-field">
              <label>Продукт</label>
              <div>{selected.product}</div>
            </div>
            <div className="drawer-field">
              <label>Тип</label>
              <div>{selected.kind}</div>
            </div>
            <div className="drawer-field">
              <label>itemId</label>
              <div>{selected.itemId ?? '—'}</div>
            </div>
            <div className="drawer-field">
              <label>Источник (лист / ячейка)</label>
              <div>{formatSource(selected)}</div>
            </div>
            {selected.issues.length > 0 ? (
              <div className="drawer-field">
                <label>Замечания</label>
                <ul className="drawer-issues">
                  {selected.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="drawer-actions">
              <button
                type="button"
                className="page-btn small"
                onClick={() => void handleCopy(selected.sku)}
              >
                Копировать SKU
              </button>
              <button
                type="button"
                className="page-btn small"
                onClick={() => void handleCopy(selected.name)}
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
