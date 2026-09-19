import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  builderReducer,
  createInitialState,
  type BuilderAction,
  type BuilderState,
} from './builderReducer';
import { localDraftRepository, loadSidebarCollapsed, saveSidebarCollapsed } from '../services/localDraftRepository';
import { validateProposal, collectBlockingIssues } from '../domain/validateProposal';
import { buildProposalDocument, describeStructure } from '../domain/buildProposalDocument';
import { calculateOptionSync } from '../domain/calculateOption';
import { formatMoney } from '../domain/money';
import { formatDateRu } from '../domain/dates';
import { exportService } from '../services/pdfExporter';
import { saveAs } from 'file-saver';
import type { Proposal } from '../domain/types';

/** Build export document from a synchronous snapshot — never from a stale React closure after dispatch. */
function proposalForExport(proposal: Proposal, revision: number): Proposal {
  return {
    ...proposal,
    options: proposal.options.map((option) => ({
      ...option,
      calculation: calculateOptionSync(option, revision),
    })),
    updatedAt: new Date().toISOString(),
  };
}

interface BuilderContextValue {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  issues: ReturnType<typeof validateProposal>;
  blockingIssues: ReturnType<typeof collectBlockingIssues>;
  structure: ReturnType<typeof describeStructure>;
  document: ReturnType<typeof buildProposalDocument>;
  activeOption: BuilderState['proposal']['options'][number] | undefined;
  saveDraft: () => Promise<void>;
  exportDocx: () => Promise<void>;
  exportPdf: () => Promise<void>;
  formatOptionTotal: (optionId: string) => string;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, undefined, () => {
    const initial = createInitialState();
    initial.ui.sidebarCollapsed = loadSidebarCollapsed();
    return initial;
  });
  const hydratedRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await localDraftRepository.load();
      if (cancelled || hydratedRef.current) return;
      hydratedRef.current = true;
      if (draft) {
        dispatch({ type: 'SET_DRAFT_PROMPT', show: true });
        // stash draft on window for restore action via custom event pattern — keep in ref
        (window as unknown as { __indeedDraft?: typeof draft }).__indeedDraft = draft;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveSidebarCollapsed(state.ui.sidebarCollapsed);
  }, [state.ui.sidebarCollapsed]);

  useEffect(() => {
    if (!state.ui.toast) return;
    const t = window.setTimeout(() => dispatch({ type: 'SET_TOAST', message: null }), 2800);
    return () => window.clearTimeout(t);
  }, [state.ui.toast]);

  const issues = useMemo(() => validateProposal(state.proposal), [state.proposal]);
  const blockingIssues = useMemo(() => collectBlockingIssues(state.proposal), [state.proposal]);
  const document = useMemo(() => buildProposalDocument(state.proposal), [state.proposal]);
  const structure = useMemo(() => describeStructure(state.proposal), [state.proposal]);
  const activeOption = state.proposal.options.find((o) => o.id === state.ui.activeOptionId) ?? state.proposal.options[0];

  const saveDraft = useCallback(async () => {
    try {
      const snap = stateRef.current;
      await localDraftRepository.save({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        proposal: snap.proposal,
        ui: {
          activeStep: snap.ui.activeStep,
          activeOptionId: snap.ui.activeOptionId,
          sidebarCollapsed: snap.ui.sidebarCollapsed,
        },
      });
      dispatch({ type: 'MARK_CLEAN' });
      dispatch({ type: 'SET_TOAST', message: 'Черновик сохранён' });
    } catch (e) {
      dispatch({
        type: 'SET_TOAST',
        message: e instanceof Error ? e.message : 'Ошибка сохранения',
      });
    }
  }, []);

  const exportDocx = useCallback(async () => {
    dispatch({ type: 'SET_EXPORT_PENDING', kind: 'docx' });
    try {
      const snap = stateRef.current;
      const revision = snap.revision + 1;
      const proposal = proposalForExport(snap.proposal, revision);
      dispatch({ type: 'RECALCULATE_ALL' });
      const doc = buildProposalDocument(proposal);
      const blob = await exportService.toDocx(doc);
      saveAs(blob, `${doc.fileBaseName}.docx`);
      dispatch({ type: 'SET_TOAST', message: 'DOCX (демонстрационный черновик) скачан' });
    } catch (e) {
      dispatch({ type: 'SET_TOAST', message: e instanceof Error ? e.message : 'Ошибка экспорта DOCX' });
    } finally {
      dispatch({ type: 'SET_EXPORT_PENDING', kind: null });
    }
  }, []);

  const exportPdf = useCallback(async () => {
    dispatch({ type: 'SET_EXPORT_PENDING', kind: 'pdf' });
    try {
      const snap = stateRef.current;
      const revision = snap.revision + 1;
      const proposal = proposalForExport(snap.proposal, revision);
      dispatch({ type: 'RECALCULATE_ALL' });
      const doc = buildProposalDocument(proposal);
      const blob = await exportService.toPdf(doc);
      saveAs(blob, `${doc.fileBaseName}.pdf`);
      dispatch({ type: 'SET_TOAST', message: 'PDF (демонстрационный черновик) скачан' });
    } catch (e) {
      dispatch({ type: 'SET_TOAST', message: e instanceof Error ? e.message : 'Ошибка экспорта PDF' });
    } finally {
      dispatch({ type: 'SET_EXPORT_PENDING', kind: null });
    }
  }, []);

  const formatOptionTotal = useCallback(
    (optionId: string) => {
      const opt = state.proposal.options.find((o) => o.id === optionId);
      const calc = opt?.calculation;
      if (!calc) return '—';
      if (calc.status === 'complete' && calc.totals.amount != null) {
        return formatMoney(calc.totals.amount);
      }
      if (calc.totals.knownSubtotal) {
        return `${formatMoney(calc.totals.knownSubtotal)} (частично)`;
      }
      return 'Требуется уточнение';
    },
    [state.proposal.options],
  );

  const value: BuilderContextValue = {
    state,
    dispatch,
    issues,
    blockingIssues,
    structure,
    document,
    activeOption,
    saveDraft,
    exportDocx,
    exportPdf,
    formatOptionTotal,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder outside provider');
  return ctx;
}

export function validityLabel(proposal: BuilderState['proposal']): string {
  const v = proposal.validity;
  if (v.kind === 'days') return `${v.days} дней`;
  if (v.kind === 'calendar_months') return v.months === 1 ? '1 месяц' : `${v.months} мес.`;
  return `закупка в ${v.year}`;
}

export function metaDate(proposal: BuilderState['proposal']): string {
  return formatDateRu(proposal.issueDate);
}

export function restoreDraftFromWindow(dispatch: React.Dispatch<BuilderAction>) {
  const draft = (window as unknown as { __indeedDraft?: { proposal: BuilderState['proposal']; ui: BuilderState['ui'] } }).__indeedDraft;
  if (!draft) return;
  dispatch({
    type: 'HYDRATE',
    proposal: draft.proposal,
    ui: {
      activeStep: draft.ui.activeStep,
      activeOptionId: draft.ui.activeOptionId,
      sidebarCollapsed: draft.ui.sidebarCollapsed,
    },
    isDemoExample: false,
  });
  dispatch({ type: 'SET_TOAST', message: 'Черновик восстановлен' });
}
