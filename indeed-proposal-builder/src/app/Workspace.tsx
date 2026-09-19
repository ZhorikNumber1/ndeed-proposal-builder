import { useNavigate } from 'react-router-dom';
import { useBuilder } from './BuilderProvider';
import { StepDetails } from '../features/proposal-details/StepDetails';
import { StepConfiguration } from '../features/configuration/StepConfiguration';
import { StepCalculation } from '../features/calculation/StepCalculation';
import { DocumentPreview, ExportPanel } from '../features/document-preview/DocumentPreview';
import { validateStep1 } from '../domain/validateProposal';

function Stepper() {
  const { state, dispatch } = useBuilder();
  const steps = [
    { n: 1 as const, label: 'Данные КП' },
    { n: 2 as const, label: 'Продукты и конфигурация' },
    { n: 3 as const, label: 'Параметры и расчёты' },
    { n: 4 as const, label: 'Предпросмотр и экспорт' },
  ];
  return (
    <div className="stepper" role="navigation" aria-label="Шаги создания КП">
      {steps.map((s) => {
        const done = state.ui.activeStep > s.n;
        const active = state.ui.activeStep === s.n;
        return (
          <button
            key={s.n}
            type="button"
            className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_STEP', step: s.n })}
          >
            <div className="step-num">{s.n}</div>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function BuilderActions() {
  const navigate = useNavigate();
  const { state, dispatch, saveDraft, saveStatus } = useBuilder();
  const step = state.ui.activeStep;

  return (
    <div className="actions-bottom">
      <button type="button" className="bottom-btn ghost" onClick={() => navigate('/')}>
        На главную
      </button>
      {state.isDemoExample ? (
        <button type="button" className="bottom-btn ghost" onClick={() => dispatch({ type: 'LOAD_DEMO' })}>
          Сбросить пример
        </button>
      ) : null}
      <button type="button" className="bottom-btn" onClick={() => void saveDraft()}>
        Сохранить черновик
        {saveStatus === 'saving' ? '…' : ''}
      </button>
      <button
        type="button"
        className="bottom-btn small"
        disabled={step === 1}
        onClick={() => dispatch({ type: 'SET_STEP', step: (step - 1) as 1 | 2 | 3 | 4 })}
      >
        Назад
      </button>
      <button
        type="button"
        className="bottom-btn next"
        disabled={step === 4}
        onClick={() => {
          if (step === 1) {
            const issues = validateStep1(state.proposal);
            if (issues.length) {
              dispatch({ type: 'SET_TOAST', message: issues[0].message });
              return;
            }
          }
          dispatch({ type: 'SET_STEP', step: (step + 1) as 1 | 2 | 3 | 4 });
        }}
      >
        Далее <span>→</span>
      </button>
    </div>
  );
}

export function Workspace() {
  const { state } = useBuilder();
  const step = state.ui.activeStep;

  return (
    <section className="workspace">
      <Stepper />
      <div className="builder-grid">
        <div className="left-col">
          {step === 1 ? <StepDetails /> : null}
          {step === 2 ? <StepConfiguration /> : null}
          {step === 3 ? <StepCalculation /> : null}
          {step === 4 ? (
            <div className="panel panel-pad">
              <div className="panel-title">Предпросмотр и экспорт</div>
              <p className="hint">
                Полный документ формируется из того же состояния, что конфигурация и итоги. Экспорт — демонстрационный
                черновик.
              </p>
            </div>
          ) : null}
        </div>
        <div className="right-col">
          <DocumentPreview />
          <ExportPanel />
        </div>
      </div>
      <BuilderActions />
      {state.ui.previewExpanded ? <DocumentPreview expanded /> : null}
    </section>
  );
}
