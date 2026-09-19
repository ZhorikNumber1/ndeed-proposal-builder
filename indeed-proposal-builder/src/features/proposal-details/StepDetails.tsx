import { useBuilder, validityLabel } from '../../app/BuilderProvider';
import type { Validity } from '../../domain/types';

export function StepDetails() {
  const { state, dispatch } = useBuilder();
  const p = state.proposal;

  const validityKind = p.validity.kind;
  const validityValue =
    p.validity.kind === 'days'
      ? p.validity.days
      : p.validity.kind === 'calendar_months'
        ? p.validity.months
        : p.validity.year;

  function setValidity(kind: Validity['kind'], value: number) {
    let validity: Validity;
    if (kind === 'days') validity = { kind, days: value };
    else if (kind === 'calendar_months') validity = { kind, months: value };
    else validity = { kind, year: value };
    dispatch({ type: 'UPDATE_META', patch: { validity } });
  }

  const missing = {
    number: !p.number.trim(),
    issueDate: !p.issueDate,
    customer: !p.customer.legalName.trim(),
    manager: !p.manager.displayName.trim(),
  };

  return (
    <div className="panel panel-pad">
      <div className="panel-title">Данные коммерческого предложения</div>
      <p className="hint">
        Локальный номер КП не является уникальным номером корпоративного реестра. Подписант берётся из демо-профиля
        поставщика и не равен менеджеру КП.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="kp-number">Номер КП</label>
          <input
            id="kp-number"
            value={p.number}
            onChange={(e) => dispatch({ type: 'UPDATE_META', patch: { number: e.target.value } })}
          />
          {missing.number ? <div className="field-error">Укажите номер КП</div> : null}
        </div>
        <div className="field">
          <label htmlFor="kp-date">Дата КП</label>
          <input
            id="kp-date"
            type="date"
            value={p.issueDate}
            onChange={(e) => dispatch({ type: 'UPDATE_META', patch: { issueDate: e.target.value } })}
          />
          {missing.issueDate ? <div className="field-error">Укажите дату КП</div> : null}
        </div>
        <div className="field">
          <label htmlFor="kp-customer">Наименование заказчика</label>
          <input
            id="kp-customer"
            value={p.customer.legalName}
            onChange={(e) => dispatch({ type: 'UPDATE_META', patch: { customerName: e.target.value } })}
          />
          {missing.customer ? <div className="field-error">Укажите наименование заказчика</div> : null}
        </div>
        <div className="field">
          <label htmlFor="kp-manager">Менеджер (метаданные)</label>
          <input
            id="kp-manager"
            value={p.manager.displayName}
            onChange={(e) => dispatch({ type: 'UPDATE_META', patch: { managerName: e.target.value } })}
          />
          {missing.manager ? <div className="field-error">Укажите менеджера</div> : null}
        </div>
        <div className="field">
          <label htmlFor="kp-validity-kind">Тип срока действия</label>
          <select
            id="kp-validity-kind"
            value={validityKind}
            onChange={(e) => {
              const kind = e.target.value as Validity['kind'];
              const fallback = kind === 'days' ? 30 : kind === 'calendar_months' ? 1 : new Date().getFullYear();
              setValidity(kind, fallback);
            }}
          >
            <option value="days">Дни</option>
            <option value="calendar_months">Календарные месяцы</option>
            <option value="purchase_year">Условие года закупки</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="kp-validity-value">Значение срока</label>
          <input
            id="kp-validity-value"
            type="number"
            min={1}
            value={validityValue}
            onChange={(e) => setValidity(validityKind, Number(e.target.value) || 1)}
          />
          <div className="demo-calc-label">Сейчас: {validityLabel(p)}</div>
        </div>
      </div>
    </div>
  );
}
