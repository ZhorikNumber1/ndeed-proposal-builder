import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useBuilder } from '../../app/BuilderProvider';
import { exportService } from '../../services/pdfExporter';
import type { DocumentBlock, ProposalDocument } from '../../domain/types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function documentFingerprint(doc: ProposalDocument): string {
  return JSON.stringify({
    base: doc.fileBaseName,
    demo: doc.isDemo,
    notes: doc.unresolvedNotes,
    blocks: doc.blocks,
  });
}

type FitMode = 'width' | 'manual';

export function DocumentPreview({ expanded }: { expanded?: boolean }) {
  const { document, dispatch, state } = useBuilder();
  const fingerprint = useMemo(() => documentFingerprint(document), [document]);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);
  const blobCacheRef = useRef<{ fp: string; blob: Blob } | null>(null);

  const generatePdf = useCallback(async (fp: string, doc: ProposalDocument, signal: { cancelled: boolean }) => {
    if (blobCacheRef.current?.fp === fp) {
      return blobCacheRef.current.blob;
    }
    setStatus('loading');
    setError(null);
    try {
      const blob = await exportService.toPdf(doc);
      if (signal.cancelled) return null;
      blobCacheRef.current = { fp, blob };
      return blob;
    } catch (e) {
      if (signal.cancelled) return null;
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Не удалось сформировать PDF');
      return null;
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    const timer = window.setTimeout(() => {
      void (async () => {
        const blob = await generatePdf(fingerprint, document, signal);
        if (signal.cancelled || !blob) return;
        setPdfBlob(blob);
        setStatus('ready');
      })();
    }, 280);
    return () => {
      signal.cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fingerprint, document, generatePdf]);

  useEffect(() => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    const gen = ++renderGenRef.current;
    void (async () => {
      try {
        const loadingTask = getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        if (cancelled || gen !== renderGenRef.current) {
          await pdf.destroy();
          return;
        }
        setPdfDoc((prev) => {
          void prev?.destroy();
          return pdf;
        });
        setPageCount(pdf.numPages);
        setCurrentPage(1);
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Ошибка PDF viewer');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, dispatch]);

  useEffect(() => {
    return () => {
      setPdfDoc((prev) => {
        void prev?.destroy();
        return null;
      });
    };
  }, []);

  const applyFitWidth = useCallback(async () => {
    const wrap = wrapRef.current;
    if (!pdfDoc || !wrap) return;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const available = Math.max(120, wrap.clientWidth - 24);
    const next = Math.min(2, Math.max(0.5, available / viewport.width));
    setFitMode('width');
    setScale(next);
  }, [pdfDoc]);

  useEffect(() => {
    if (status !== 'ready' || !pdfDoc) return;
    if (fitMode !== 'width') return;
    void applyFitWidth();
  }, [status, fitMode, applyFitWidth, expanded, pageCount, pdfDoc]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let debounce: number | null = null;
    const ro = new ResizeObserver(() => {
      if (fitMode !== 'width') return;
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void applyFitWidth(), 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (debounce != null) window.clearTimeout(debounce);
    };
  }, [fitMode, applyFitWidth]);

  const setManualScale = (next: number) => {
    setFitMode('manual');
    setScale(Math.min(2, Math.max(0.5, next)));
  };

  const toolbar = (
    <div className="preview-toolbar">
      <div className="preview-toolbar-left">
        <span className="preview-title">Предпросмотр КП</span>
        {status === 'loading' ? <span className="preview-status">Обновление…</span> : null}
        {status === 'error' ? <span className="preview-status error">Ошибка</span> : null}
        {pageCount > 0 ? (
          <span className="preview-status">
            Стр. {currentPage} / {pageCount}
          </span>
        ) : null}
      </div>
      <div className="preview-toolbar-right">
        <button type="button" className="full-btn" onClick={() => setManualScale(scale - 0.1)} aria-label="Уменьшить">
          −
        </button>
        <button type="button" className="full-btn" onClick={() => setManualScale(scale + 0.1)} aria-label="Увеличить">
          +
        </button>
        <button
          type="button"
          className="full-btn"
          onClick={() => {
            setFitMode('width');
            void applyFitWidth();
          }}
        >
          По ширине
        </button>
        <span className="preview-scale">{Math.round(scale * 100)}%</span>
        {!expanded ? (
          <button type="button" className="full-btn" onClick={() => dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: true })}>
            На весь экран ↗
          </button>
        ) : (
          <button type="button" className="full-btn" onClick={() => dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: false })}>
            Закрыть (Esc)
          </button>
        )}
      </div>
    </div>
  );

  const body = (
    <div className={`paper-wrap pdf-wrap ${expanded ? 'expanded' : ''}`} ref={wrapRef}>
      {status === 'error' ? (
        <div className="preview-error">
          <p>{error ?? 'Не удалось показать PDF'}</p>
          <button
            type="button"
            className="bottom-btn"
            onClick={() => {
              blobCacheRef.current = null;
              setStatus('loading');
              void generatePdf(fingerprint, document, { cancelled: false }).then((blob) => {
                if (blob) {
                  setPdfBlob(blob);
                  setStatus('ready');
                }
              });
            }}
          >
            Повторить
          </button>
          <HtmlDocumentFallback document={document} />
        </div>
      ) : null}
      {status !== 'error' && pdfDoc ? <PdfPages pdf={pdfDoc} scale={scale} onVisiblePage={setCurrentPage} /> : null}
      {status === 'loading' && !pdfBlob ? (
        <div className="preview-loading">Формирование PDF…</div>
      ) : null}
      {document.unresolvedNotes.length > 0 ? (
        <div className="preview-unresolved">
          <strong>Незавершённые данные</strong>
          <ul>
            {document.unresolvedNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.ui.calculationPending ? <div className="preview-loading">Расчёт обновляется…</div> : null}
    </div>
  );

  if (expanded) {
    return (
      <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Полный предпросмотр">
        <div className="preview-overlay-toolbar">{toolbar}</div>
        <div className="preview-overlay-body">{body}</div>
      </div>
    );
  }

  return (
    <div className="card preview-card">
      {toolbar}
      {body}
    </div>
  );
}

function PdfPages({
  pdf,
  scale,
  onVisiblePage,
}: {
  pdf: PDFDocumentProxy;
  scale: number;
  onVisiblePage: (page: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let cancelled = false;
    void (async () => {
      root.innerHTML = '';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        if (cancelled) break;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        canvas.dataset.page = String(pageNum);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const wrap = document.createElement('div');
        wrap.className = 'pdf-page';
        wrap.appendChild(canvas);
        root.appendChild(wrap);
        const task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
      }
      if (!cancelled) setTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, scale]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const pages = [...root.querySelectorAll('.pdf-page-canvas')];
    if (!pages.length) return;
    const scrollRoot = root.closest('.paper-wrap');
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const n = Number((visible.target as HTMLElement).dataset.page);
          if (n) onVisiblePage(n);
        }
      },
      { root: scrollRoot instanceof Element ? scrollRoot : null, threshold: [0.3, 0.6] },
    );
    pages.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [tick, onVisiblePage]);

  return <div className="pdf-pages" ref={containerRef} />;
}

function HtmlDocumentFallback({ document }: { document: ProposalDocument }) {
  return (
    <div className="paper html-fallback" aria-label="Текстовый запасной предпросмотр">
      {document.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: DocumentBlock }) {
  switch (block.type) {
    case 'demoBanner':
      return <div className="demo-banner-doc">{block.text}</div>;
    case 'supplierHeader':
      return (
        <>
          <div className="paper-header">
            {block.lines.map((l, i) => (
              <div key={i}>
                {i === 0 ? <strong>{l}</strong> : l}
                {i < block.lines.length - 1 ? <br /> : null}
              </div>
            ))}
          </div>
          <div className="red-line" />
        </>
      );
    case 'meta':
      return (
        <div className="doc-meta">
          <div>{block.left}</div>
          <div>{block.center}</div>
          <div>{block.right}</div>
        </div>
      );
    case 'heading':
      if (block.level === 1) return <div className="doc-title">{block.text}</div>;
      return <div className="doc-table-title">{block.text}</div>;
    case 'paragraph':
      return <p className="doc-text">{block.text}</p>;
    case 'note':
      return <p className="doc-note">{block.text}</p>;
    case 'list':
      return (
        <ul className="doc-text">
          {block.items.map((item) => (
            <li key={item.slice(0, 40)}>{item}</li>
          ))}
        </ul>
      );
    case 'signature':
      return (
        <div className="doc-text">
          {block.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      );
    case 'table':
      return (
        <>
          <table className="doc-table">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, idx) => (
                <tr key={idx} className={r.isTotal ? 'total' : undefined}>
                  {r.cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.footnote ? <p className="doc-note">{block.footnote}</p> : null}
        </>
      );
    default:
      return null;
  }
}

export function ExportPanel() {
  const { exportDocx, exportPdf, state, blockingIssues } = useBuilder();
  return (
    <div className="card export-card">
      <div className="export-title">Экспорт КП</div>
      <div className="export-sub">
        Скачивается <strong>демонстрационный черновик</strong> (DOCX/PDF). Блокирующие замечания ({blockingIssues.length}) не
        запрещают честный демо-экспорт. PDF совпадает с предпросмотром.
      </div>
      <div className="export-row">
        <button
          type="button"
          className="export-btn"
          disabled={state.ui.exportPending !== null}
          onClick={() => void exportDocx()}
        >
          Скачать КП в Word (.docx)
        </button>
        <button
          type="button"
          className="export-btn"
          disabled={state.ui.exportPending !== null}
          onClick={() => void exportPdf()}
        >
          Скачать КП в PDF
        </button>
      </div>
    </div>
  );
}
