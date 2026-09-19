import { useEffect, useState } from 'react';
import { useBuilder } from '../../app/BuilderProvider';
import type { DocumentBlock } from '../../domain/types';

export function DocumentPreview({ expanded }: { expanded?: boolean }) {
  const { document, dispatch } = useBuilder();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, dispatch]);

  const paper = (
    <div className="paper" style={expanded ? undefined : { transform: `scale(${scale})`, width: `${100 / scale}%` }}>
      {document.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      {document.unresolvedNotes.length > 0 ? (
        <div className="doc-text">
          <strong>Незавершённые данные:</strong>
          <ul>
            {document.unresolvedNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  if (expanded) {
    return (
      <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Полный предпросмотр">
        <div className="preview-overlay-toolbar">
          <button type="button" className="bottom-btn small" onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}>
            −
          </button>
          <button type="button" className="bottom-btn small" onClick={() => setScale((s) => Math.min(1.4, s + 0.1))}>
            +
          </button>
          <button type="button" className="bottom-btn" onClick={() => dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: false })}>
            Закрыть (Esc)
          </button>
        </div>
        <div className="preview-overlay-body">
          <div className="paper" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            {document.blocks.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card preview-card">
      <div className="preview-head">
        <div className="preview-title">Предпросмотр КП</div>
        <button type="button" className="full-btn" onClick={() => dispatch({ type: 'SET_PREVIEW_EXPANDED', expanded: true })}>
          На весь экран ↗
        </button>
      </div>
      <div className="paper-wrap">{paper}</div>
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
                    <td key={i} colSpan={r.isTotal && i === 0 ? undefined : undefined}>
                      {c}
                    </td>
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
        запрещают честный демо-экспорт.
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
