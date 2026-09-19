import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  builderReducer,
  createInitialState,
  type BuilderAction,
  type BuilderState,
} from './builderReducer';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '../services/localDraftRepository';
import { draftCollectionRepository } from '../services/draftCollectionRepository';
import type { DraftEnvelope } from '../domain/draftTypes';
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
  saveStatus: 'saved' | 'saving' | 'error';
  draftRevision: number;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

const AUTOSAVE_MS = 600;

export function BuilderProvider({ children, draftId }: { children: ReactNode; draftId: string }) {
  const [state, dispatch] = useReducer(builderReducer, undefined, () => {
    const initial = createInitialState();
    initial.ui.sidebarCollapsed = loadSidebarCollapsed();
    return initial;
  });
  const hydratedRef = useRef(false);
  const stateRef = useRef(state);
  const draftEnvelopeRef = useRef<DraftEnvelope | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [draftRevision, setDraftRevision] = useState(1);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await draftCollectionRepository.migrateLegacyIfNeeded();
      const draft = await draftCollectionRepository.get(draftId);
      if (cancelled || hydratedRef.current) return;
      hydratedRef.current = true;
      if (!draft) return;
      draftEnvelopeRef.current = draft;
      setDraftRevision(draft.revision);
      setSaveStatus(draft.saveStatus ?? 'saved');
      dispatch({
        type: 'HYDRATE',
        proposal: draft.proposal,
        ui: {
          activeStep: draft.builder.activeStep,
          activeOptionId: draft.builder.activeOptionId ?? draft.proposal.options[0]?.id ?? '',
          sidebarCollapsed: loadSidebarCollapsed(),
        },
        isDemoExample: draft.title === 'Демо-пример',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const persistDraft = useCallback(async (flush = false): Promise<void> => {
    const envelope = draftEnvelopeRef.current;
    if (!envelope) return;
    const snap = stateRef.current;
    const nextEnvelope: DraftEnvelope = {
      ...envelope,
      proposal: snap.proposal,
      builder: {
        activeStep: snap.ui.activeStep,
        activeOptionId: snap.ui.activeOptionId || null,
      },
      saveStatus: 'saving',
    };
    setSaveStatus('saving');
    try {
      const result = await draftCollectionRepository.save(nextEnvelope, envelope.revision);
      if (!result.ok) {
        setSaveStatus('error');
        draftEnvelopeRef.current = result.stored;
        setDraftRevision(result.stored.revision);
        dispatch({ type: 'SET_TOAST', message: 'Конфликт версий — черновик обновлён из хранилища' });
        dispatch({
          type: 'HYDRATE',
          proposal: result.stored.proposal,
          ui: {
            activeStep: result.stored.builder.activeStep,
            activeOptionId: result.stored.builder.activeOptionId ?? result.stored.proposal.options[0]?.id ?? '',
          },
          isDemoExample: result.stored.title === 'Демо-пример',
        });
        return;
      }
      draftEnvelopeRef.current = result.draft;
      setDraftRevision(result.draft.revision);
      setSaveStatus('saved');
      dispatch({ type: 'MARK_CLEAN' });
      if (flush) {
        dispatch({ type: 'SET_TOAST', message: 'Черновик сохранён' });
      }
    } catch (e) {
      setSaveStatus('error');
      dispatch({
        type: 'SET_TOAST',
        message: e instanceof Error ? e.message : 'Ошибка сохранения',
      });
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || !state.ui.dirty) return;
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft(false);
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state.proposal, state.ui.activeStep, state.ui.activeOptionId, state.ui.dirty, persistDraft]);

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
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await persistDraft(true);
  }, [persistDraft]);

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
    saveStatus,
    draftRevision,
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
