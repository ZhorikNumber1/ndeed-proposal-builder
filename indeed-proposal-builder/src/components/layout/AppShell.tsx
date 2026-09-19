import { useBuilder, metaDate, validityLabel, restoreDraftFromWindow } from '../../app/BuilderProvider';
import {
  IconBell,
  IconBox,
  IconDatabase,
  IconFile,
  IconFiles,
  IconHelp,
  IconHome,
  IconTemplate,
} from '../ui/Icons';
import { useEffect, useRef } from 'react';

const SOON = 'Раздел появится позже';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, dispatch, blockingIssues } = useBuilder();
  const collapsed = state.ui.sidebarCollapsed;

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : 'drawer-open'}`}>
      <aside className="sidebar" aria-label="Навигация">
        <div className="brand" aria-label="Индид">
          Индид
        </div>
        <nav className="nav">
          <SoonItem icon={<IconHome />} label="Главная" />
          <button type="button" className="nav-item active" aria-current="page">
            <IconFile />
            <span>Конструктор КП</span>
          </button>
          <SoonItem icon={<IconFile />} label="Мои КП" />
          <SoonItem icon={<IconFiles />} label="Все КП" />
          <SoonItem icon={<IconBox />} label="Продукты" />
          <SoonItem icon={<IconTemplate />} label="Шаблоны КП" />
          <SoonItem icon={<IconDatabase />} label="Справочники" />
        </nav>
        <button
          type="button"
          className="collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          onClick={() => dispatch({ type: 'SET_SIDEBAR', collapsed: !collapsed })}
        >
          <span className="circle" aria-hidden>
            ‹
          </span>
          <span>{collapsed ? 'Развернуть меню' : 'Свернуть меню'}</span>
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => dispatch({ type: 'SET_SIDEBAR', collapsed: false })}
            >
              Меню
            </button>
            <div className="title">Конструктор КП</div>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Замечания к КП: ${blockingIssues.length}`}
              onClick={() => dispatch({ type: 'SET_SHOW_ISSUES', show: true })}
            >
              <IconBell />
              {blockingIssues.length > 0 ? <span className="badge">{blockingIssues.length}</span> : null}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Справка по вводу"
              onClick={() => dispatch({ type: 'SET_SHOW_HELP', show: true })}
            >
              <IconHelp />
            </button>
            <div className="profile" title="Профиль оболочки без авторизации">
              <div className="avatar" aria-hidden>
                ИК
              </div>
              <div>
                <div className="profile-name">{state.proposal.manager.displayName || 'Менеджер'}</div>
                <div className="profile-role">Менеджер</div>
              </div>
            </div>
          </div>
        </header>
        {children}
      </div>

      {state.ui.toast ? <div className="toast" role="status">{state.ui.toast}</div> : null}
      {state.ui.showHelp ? <HelpDialog /> : null}
      {state.ui.showIssues ? <IssuesDialog /> : null}
      {state.ui.draftRestorePrompt ? <DraftRestoreDialog /> : null}
    </div>
  );
}

function SoonItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="nav-item soon" disabled data-tip={SOON} title={SOON} aria-label={`${label}. ${SOON}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HelpDialog() {
  const { dispatch } = useBuilder();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_SHOW_HELP', show: false });
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  return (
    <div className="dialog-backdrop" role="presentation" onClick={() => dispatch({ type: 'SET_SHOW_HELP', show: false })}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" ref={ref} onClick={(e) => e.stopPropagation()}>
        <h2 id="help-title">Памятка по вводу</h2>
        <p>Примеры запросов: <code>PAM25 FSTEC</code>, <code>PAM ФСТЭК на 77 пользователей</code>, <code>PAM 10 CS</code>, <code>AM WL LDAP 437</code>.</p>
        <p>«не ФСТЭК» / «обычная версия» отменяют сертификацию. Срок «12 месяцев» не становится количеством пользователей.</p>
        <p>После распознавания нажмите «Применить», чтобы не затереть ручные правки автоматически.</p>
        <div className="dialog-actions">
          <button type="button" className="bottom-btn" onClick={() => dispatch({ type: 'SET_SHOW_HELP', show: false })}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function IssuesDialog() {
  const { dispatch, blockingIssues, issues } = useBuilder();
  const list = blockingIssues.length ? blockingIssues : issues.slice(0, 20);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_SHOW_ISSUES', show: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  return (
    <div className="dialog-backdrop" onClick={() => dispatch({ type: 'SET_SHOW_ISSUES', show: false })}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="issues-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="issues-title">Замечания к текущему КП</h2>
        {list.length === 0 ? <p>Актуальных замечаний нет.</p> : (
          <ul>
            {list.map((i, idx) => (
              <li key={`${i.code}-${idx}`}>{i.message}</li>
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button type="button" className="bottom-btn" onClick={() => dispatch({ type: 'SET_SHOW_ISSUES', show: false })}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftRestoreDialog() {
  const { dispatch } = useBuilder();
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="draft-title">
        <h2 id="draft-title">Найден сохранённый черновик</h2>
        <p>Восстановить предыдущую работу или начать с демонстрационного примера?</p>
        <div className="dialog-actions">
          <button
            type="button"
            className="bottom-btn"
            onClick={() => {
              dispatch({ type: 'LOAD_DEMO' });
              dispatch({ type: 'SET_DRAFT_PROMPT', show: false });
            }}
          >
            Демо-пример
          </button>
          <button
            type="button"
            className="bottom-btn next"
            onClick={() => {
              restoreDraftFromWindow(dispatch);
              dispatch({ type: 'SET_DRAFT_PROMPT', show: false });
            }}
          >
            Восстановить
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProposalMetaCard() {
  const { state, dispatch } = useBuilder();
  const p = state.proposal;
  return (
    <div className="card status-card">
      <div className="status-main">
        <div className="big-check" aria-hidden>
          ✓
        </div>
        <div>
          <div className="status-title">Шаг 1 завершён.</div>
          <div className="status-sub">Данные КП сохранены.</div>
        </div>
      </div>
      <div>
        <div className="meta-label">КП</div>
        <div className="meta-value">{p.number || '—'}</div>
      </div>
      <div>
        <div className="meta-label">Дата</div>
        <div className="meta-value">{metaDate(p)}</div>
      </div>
      <div>
        <div className="meta-label">Заказчик</div>
        <div className="meta-value">{p.customer.legalName || '—'}</div>
      </div>
      <div>
        <div className="meta-label">Менеджер</div>
        <div className="meta-value">{p.manager.displayName || '—'}</div>
      </div>
      <div>
        <div className="meta-label">Срок действия предложения</div>
        <div className="meta-value">{validityLabel(p)}</div>
      </div>
      <button type="button" className="edit-btn" onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}>
        ✎ Изменить
      </button>
    </div>
  );
}

