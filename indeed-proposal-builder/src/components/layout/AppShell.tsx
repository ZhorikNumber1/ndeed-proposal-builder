import { Link, useNavigate } from 'react-router-dom';
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
import { useEffect, useRef, useState } from 'react';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '../../services/localDraftRepository';
import { draftCollectionRepository } from '../../services/draftCollectionRepository';
import { metaDate, useBuilder, validityLabel } from '../../app/BuilderProvider';

const SOON = 'Раздел появится позже';

export type AppNav = 'home' | 'builder' | 'articles';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  activeNav: AppNav;
  builderMode?: boolean;
}

export function AppShell({ children, title, activeNav, builderMode = false }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => loadSidebarCollapsed());

  useEffect(() => {
    saveSidebarCollapsed(collapsed);
  }, [collapsed]);

  if (builderMode) {
    return (
      <BuilderAppShellInner collapsed={collapsed} setCollapsed={setCollapsed} title={title} activeNav={activeNav}>
        {children}
      </BuilderAppShellInner>
    );
  }

  return (
    <ShellLayout collapsed={collapsed} setCollapsed={setCollapsed} title={title} activeNav={activeNav}>
      {children}
    </ShellLayout>
  );
}

function ShellLayout({
  children,
  collapsed,
  setCollapsed,
  title,
  activeNav,
  topActions,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  title: string;
  activeNav: AppNav;
  topActions?: React.ReactNode;
}) {
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : 'drawer-open'}`}>
      <aside className="sidebar" aria-label="Навигация">
        <Link to="/" className="brand" aria-label="Индид">
          Индид
        </Link>
        <nav className="nav">
          <NavLink to="/" icon={<IconHome />} label="Главная" active={activeNav === 'home'} />
          {activeNav === 'builder' ? (
            <span className="nav-item active" aria-current="page">
              <IconFile />
              <span>Конструктор</span>
            </span>
          ) : (
            <ConstructorNavItem />
          )}
          <NavLink to="/articles" icon={<IconDatabase />} label="Артикулы" active={activeNav === 'articles'} />
          <SoonItem icon={<IconFiles />} label="Мои КП" />
          <SoonItem icon={<IconFiles />} label="Все КП" />
          <SoonItem icon={<IconBox />} label="Продукты" />
          <SoonItem icon={<IconTemplate />} label="Шаблоны КП" />
        </nav>
        <button
          type="button"
          className="collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          onClick={() => setCollapsed(!collapsed)}
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
              onClick={() => setCollapsed(false)}
            >
              Меню
            </button>
            <div className="title">{title}</div>
          </div>
          {topActions ?? (
            <div className="top-actions">
              <div className="profile" title="Профиль оболочки без авторизации">
                <div className="avatar" aria-hidden>
                  ИК
                </div>
                <div>
                  <div className="profile-name">Менеджер</div>
                  <div className="profile-role">Менеджер</div>
                </div>
              </div>
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

function ConstructorNavItem() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const openConstructor = async () => {
    if (pending) return;
    setPending(true);
    try {
      await draftCollectionRepository.migrateLegacyIfNeeded();
      const list = await draftCollectionRepository.list();
      if (list[0]) {
        navigate(`/proposals/${list[0].id}/edit`);
        return;
      }
      const draft = await draftCollectionRepository.create();
      navigate(`/proposals/${draft.id}/edit`);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="nav-item"
      disabled={pending}
      onClick={() => void openConstructor()}
    >
      <IconFile />
      <span>Конструктор</span>
    </button>
  );
}

function NavLink({
  to,
  icon,
  label,
  active,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      to={to}
      className={`nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function BuilderAppShellInner({
  children,
  collapsed,
  setCollapsed,
  title,
  activeNav,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  title: string;
  activeNav: AppNav;
}) {
  const { state, dispatch, blockingIssues } = useBuilder();

  return (
    <ShellLayout
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      title={title}
      activeNav={activeNav}
      topActions={
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
      }
    >
      {children}
      {state.ui.toast ? <div className="toast" role="status">{state.ui.toast}</div> : null}
      {state.ui.showHelp ? <HelpDialog /> : null}
      {state.ui.showIssues ? <IssuesDialog /> : null}
    </ShellLayout>
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
