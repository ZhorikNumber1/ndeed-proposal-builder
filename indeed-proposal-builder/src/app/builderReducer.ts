import type {
  BuilderUiState,
  Configuration,
  ParseCandidate,
  Proposal,
  ProposalOption,
  Validity,
} from '../domain/types';
import { calculateOptionSync } from '../domain/calculateOption';
import { createDemoProposal, createEmptyProposal, duplicateConfiguration, newConfiguration, cloneConfigurations, defaultCommercialTerms } from '../data/demoProposal';
import { candidateToConfiguration } from '../domain/normalizeRequest';

export interface BuilderState {
  proposal: Proposal;
  ui: BuilderUiState;
  isDemoExample: boolean;
  revision: number;
}

export type BuilderAction =
  | { type: 'HYDRATE'; proposal: Proposal; ui?: Partial<BuilderUiState>; isDemoExample?: boolean }
  | { type: 'NEW_PROPOSAL' }
  | { type: 'LOAD_DEMO' }
  | { type: 'SET_STEP'; step: 1 | 2 | 3 | 4 }
  | { type: 'SET_SIDEBAR'; collapsed: boolean }
  | { type: 'SET_PREVIEW_EXPANDED'; expanded: boolean }
  | { type: 'SET_ACTIVE_OPTION'; optionId: string }
  | { type: 'UPDATE_META'; patch: Partial<Pick<Proposal, 'number' | 'issueDate' | 'rawRequest'>> & {
      customerName?: string;
      managerName?: string;
      validity?: Validity;
    } }
  | { type: 'SET_RAW_REQUEST'; value: string }
  | { type: 'SET_PARSE_CANDIDATE'; candidate: ParseCandidate | null }
  | { type: 'APPLY_CANDIDATE' }
  | { type: 'UPDATE_CONFIGURATION'; optionId: string; configurationId: string; patch: Partial<Configuration> }
  | { type: 'UPDATE_MODULE'; optionId: string; configurationId: string; moduleId: string; quantity: number }
  | { type: 'ADD_MODULE'; optionId: string; configurationId: string; itemId: string }
  | { type: 'REMOVE_MODULE'; optionId: string; configurationId: string; moduleId: string }
  | { type: 'ADD_PRODUCT'; product: Configuration['product'] }
  | { type: 'REMOVE_CONFIGURATION'; optionId: string; configurationId: string }
  | { type: 'DUPLICATE_CONFIGURATION'; optionId: string; configurationId: string }
  | { type: 'TOGGLE_CONFIGURATION'; optionId: string; configurationId: string }
  | { type: 'UPDATE_OPTION_TERMS'; optionId: string; patch: Partial<ProposalOption> & { signedDiscount?: number; supportExtraYears?: number; adjustmentReason?: string | null; termMonths?: number | null } }
  | { type: 'SET_ALTERNATIVES_MODE'; mode: 'subscription' | 'perpetual' | 'both' }
  | { type: 'RECALCULATE_ALL' }
  | { type: 'SET_CALCULATION_PENDING'; pending: boolean }
  | { type: 'SET_EXPORT_PENDING'; kind: 'docx' | 'pdf' | null }
  | { type: 'SET_TOAST'; message: string | null }
  | { type: 'SET_SHOW_HELP'; show: boolean }
  | { type: 'SET_SHOW_ISSUES'; show: boolean }
  | { type: 'SET_DRAFT_PROMPT'; show: boolean }
  | { type: 'MARK_CLEAN' };

function recalcOption(option: ProposalOption, revision: number): ProposalOption {
  return {
    ...option,
    calculation: calculateOptionSync(option, revision),
  };
}

function recalcAll(proposal: Proposal, revision: number): Proposal {
  return {
    ...proposal,
    options: proposal.options.map((o) => recalcOption(o, revision)),
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialState(): BuilderState {
  const proposal = createDemoProposal();
  return {
    proposal,
    isDemoExample: true,
    revision: 1,
    ui: {
      activeStep: 2,
      activeOptionId: proposal.options[0]?.id ?? '',
      sidebarCollapsed: false,
      previewExpanded: false,
      dirty: false,
      calculationPending: false,
      exportPending: null,
      toast: null,
      showHelp: false,
      showIssues: false,
      draftRestorePrompt: false,
      parseCandidate: null,
    },
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'HYDRATE': {
      const revision = state.revision + 1;
      const proposal = recalcAll(action.proposal, revision);
      return {
        ...state,
        proposal,
        revision,
        isDemoExample: action.isDemoExample ?? false,
        ui: {
          ...state.ui,
          ...action.ui,
          activeOptionId: action.ui?.activeOptionId ?? proposal.options[0]?.id ?? '',
          dirty: false,
          draftRestorePrompt: false,
        },
      };
    }
    case 'NEW_PROPOSAL': {
      const proposal = createEmptyProposal();
      return {
        proposal,
        isDemoExample: false,
        revision: state.revision + 1,
        ui: {
          ...state.ui,
          activeStep: 1,
          activeOptionId: proposal.options[0]?.id ?? '',
          dirty: true,
          parseCandidate: null,
          toast: 'Создано новое КП',
        },
      };
    }
    case 'LOAD_DEMO': {
      const proposal = createDemoProposal();
      return {
        proposal,
        isDemoExample: true,
        revision: state.revision + 1,
        ui: {
          ...state.ui,
          activeStep: 2,
          activeOptionId: proposal.options[0]?.id ?? '',
          dirty: false,
          parseCandidate: null,
          toast: 'Загружен демонстрационный пример',
        },
      };
    }
    case 'SET_STEP':
      return { ...state, ui: { ...state.ui, activeStep: action.step } };
    case 'SET_SIDEBAR':
      return { ...state, ui: { ...state.ui, sidebarCollapsed: action.collapsed } };
    case 'SET_PREVIEW_EXPANDED':
      return { ...state, ui: { ...state.ui, previewExpanded: action.expanded } };
    case 'SET_ACTIVE_OPTION':
      return { ...state, ui: { ...state.ui, activeOptionId: action.optionId } };
    case 'UPDATE_META': {
      const proposal: Proposal = {
        ...state.proposal,
        number: action.patch.number ?? state.proposal.number,
        issueDate: action.patch.issueDate ?? state.proposal.issueDate,
        rawRequest: action.patch.rawRequest ?? state.proposal.rawRequest,
        customer: {
          legalName: action.patch.customerName ?? state.proposal.customer.legalName,
        },
        manager: {
          displayName: action.patch.managerName ?? state.proposal.manager.displayName,
        },
        validity: action.patch.validity ?? state.proposal.validity,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, proposal, ui: { ...state.ui, dirty: true } };
    }
    case 'SET_RAW_REQUEST':
      return {
        ...state,
        proposal: { ...state.proposal, rawRequest: action.value, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    case 'SET_PARSE_CANDIDATE':
      return { ...state, ui: { ...state.ui, parseCandidate: action.candidate } };
    case 'APPLY_CANDIDATE': {
      const cand = state.ui.parseCandidate;
      if (!cand || cand.products.length === 0) return state;
      const revision = state.revision + 1;
      let options = state.proposal.options.map((opt) => {
        const configs = [...opt.configurations];
        for (const p of cand.products) {
          const existing = configs.find((c) => c.product === p.product);
          if (existing) {
            // Update existing rather than duplicate
            const idx = configs.indexOf(existing);
            const next = candidateToConfiguration(p, existing.id);
            // Preserve manual modules if candidate has none
            if (!next.modules.length && existing.modules.length) {
              next.modules = existing.modules;
            }
            if (!next.quantity && existing.quantity) next.quantity = existing.quantity;
            configs[idx] = next;
          } else {
            configs.push(candidateToConfiguration(p, `cfg-${Math.random().toString(36).slice(2, 8)}`));
          }
        }
        // Apply term/license to option if detected
        let nextOpt = { ...opt, configurations: configs };
        if (cand.termMonths != null && opt.licenseType === 'subscription') {
          nextOpt = { ...nextOpt, termMonths: cand.termMonths };
        }
        return recalcOption(nextOpt, revision);
      });
      return {
        ...state,
        revision,
        proposal: {
          ...state.proposal,
          options,
          rawRequest: cand.raw,
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, dirty: true, parseCandidate: cand, toast: 'Параметры применены' },
      };
    }
    case 'UPDATE_CONFIGURATION': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const configurations = opt.configurations.map((c) =>
          c.id === action.configurationId ? { ...c, ...action.patch, modules: action.patch.modules ?? c.modules } : c,
        );
        return recalcOption({ ...opt, configurations }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'UPDATE_MODULE': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const configurations = opt.configurations.map((c) => {
          if (c.id !== action.configurationId) return c;
          return {
            ...c,
            modules: c.modules.map((m) =>
              m.id === action.moduleId ? { ...m, quantity: action.quantity } : m,
            ),
          };
        });
        return recalcOption({ ...opt, configurations }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'ADD_MODULE': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const configurations = opt.configurations.map((c) => {
          if (c.id !== action.configurationId) return c;
          if (c.modules.some((m) => m.itemId === action.itemId)) return c;
          return {
            ...c,
            modules: [
              ...c.modules,
              {
                id: `mod-${Math.random().toString(36).slice(2, 8)}`,
                itemId: action.itemId,
                metric: (action.itemId.startsWith('ITDR')
                  ? 'licensed_units'
                  : action.itemId === 'PAM.AAPM'
                    ? 'service_accounts'
                    : 'users') as import('../domain/types').Metric,
                quantity: c.quantity || 1,
              },
            ],
          };
        });
        return recalcOption({ ...opt, configurations }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'REMOVE_MODULE': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const configurations = opt.configurations.map((c) =>
          c.id === action.configurationId
            ? { ...c, modules: c.modules.filter((m) => m.id !== action.moduleId) }
            : c,
        );
        return recalcOption({ ...opt, configurations }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'ADD_PRODUCT': {
      const revision = state.revision + 1;
      const optionsIndependent = state.proposal.options.map((opt) => {
        const copy = newConfiguration(action.product);
        return recalcOption({ ...opt, configurations: [...opt.configurations, copy] }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options: optionsIndependent, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'REMOVE_CONFIGURATION': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        return recalcOption(
          { ...opt, configurations: opt.configurations.filter((c) => c.id !== action.configurationId) },
          revision,
        );
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'DUPLICATE_CONFIGURATION': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const src = opt.configurations.find((c) => c.id === action.configurationId);
        if (!src) return opt;
        return recalcOption(
          { ...opt, configurations: [...opt.configurations, duplicateConfiguration(src)] },
          revision,
        );
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'TOGGLE_CONFIGURATION': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const configurations = opt.configurations.map((c) =>
          c.id === action.configurationId ? { ...c, enabled: !c.enabled } : c,
        );
        return recalcOption({ ...opt, configurations }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'UPDATE_OPTION_TERMS': {
      const revision = state.revision + 1;
      const options = state.proposal.options.map((opt) => {
        if (opt.id !== action.optionId) return opt;
        const commercialTerms = {
          ...opt.commercialTerms,
          signedDiscount:
            action.patch.signedDiscount !== undefined
              ? action.patch.signedDiscount
              : opt.commercialTerms.signedDiscount,
          supportExtraYears:
            action.patch.supportExtraYears !== undefined
              ? action.patch.supportExtraYears
              : opt.commercialTerms.supportExtraYears,
          adjustmentReason:
            action.patch.adjustmentReason !== undefined
              ? action.patch.adjustmentReason
              : opt.commercialTerms.adjustmentReason,
        };
        let termMonths = action.patch.termMonths !== undefined ? action.patch.termMonths : opt.termMonths;
        let licenseType = action.patch.licenseType ?? opt.licenseType;
        if (licenseType === 'perpetual') termMonths = null;
        return recalcOption({ ...opt, commercialTerms, termMonths, licenseType, label: action.patch.label ?? opt.label }, revision);
      });
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, dirty: true },
      };
    }
    case 'SET_ALTERNATIVES_MODE': {
      const revision = state.revision + 1;
      let options = [...state.proposal.options];
      const sub = options.find((o) => o.licenseType === 'subscription');
      const perp = options.find((o) => o.licenseType === 'perpetual');
      if (action.mode === 'subscription' && sub) {
        options = [sub];
      } else if (action.mode === 'perpetual' && perp) {
        options = [perp];
      } else if (action.mode === 'both') {
        if (sub && perp) options = [sub, perp];
        else if (sub && !perp) {
          const copy: ProposalOption = {
            ...sub,
            id: `opt-${Math.random().toString(36).slice(2, 8)}`,
            label: 'Бессрочная',
            licenseType: 'perpetual',
            termMonths: null,
            commercialTerms: { ...defaultCommercialTerms(), ...sub.commercialTerms },
            configurations: cloneConfigurations(sub.configurations),
            calculation: null,
          };
          options = [sub, recalcOption(copy, revision)];
        }
      }
      options = options.map((o) => recalcOption(o, revision));
      return {
        ...state,
        revision,
        proposal: { ...state.proposal, options, updatedAt: new Date().toISOString() },
        ui: {
          ...state.ui,
          dirty: true,
          activeOptionId: options[0]?.id ?? '',
        },
      };
    }
    case 'RECALCULATE_ALL': {
      const revision = state.revision + 1;
      return {
        ...state,
        revision,
        proposal: recalcAll(state.proposal, revision),
      };
    }
    case 'SET_CALCULATION_PENDING':
      return { ...state, ui: { ...state.ui, calculationPending: action.pending } };
    case 'SET_EXPORT_PENDING':
      return { ...state, ui: { ...state.ui, exportPending: action.kind } };
    case 'SET_TOAST':
      return { ...state, ui: { ...state.ui, toast: action.message } };
    case 'SET_SHOW_HELP':
      return { ...state, ui: { ...state.ui, showHelp: action.show } };
    case 'SET_SHOW_ISSUES':
      return { ...state, ui: { ...state.ui, showIssues: action.show } };
    case 'SET_DRAFT_PROMPT':
      return { ...state, ui: { ...state.ui, draftRestorePrompt: action.show } };
    case 'MARK_CLEAN':
      return { ...state, ui: { ...state.ui, dirty: false } };
    default:
      return state;
  }
}
