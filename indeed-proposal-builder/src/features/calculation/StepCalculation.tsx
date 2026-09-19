import { useBuilder } from '../../app/BuilderProvider';
import { ProposalMetaCard } from '../../components/layout/AppShell';
import { formatMoney, formatMoneyPlain } from '../../domain/money';

export function StepCalculation() {
  const { state, dispatch, activeOption, formatOptionTotal } = useBuilder();
  const option = activeOption;
  if (!option) return null;

  const mode =
    state.proposal.options.length > 1
      ? 'both'
      : option.licenseType === 'perpetual'
        ? 'perpetual'
        : 'subscription';

  const direction = option.commercialTerms.signedDiscount >= 0 ? 'discount' : 'markup';
  const pct = Math.round(Math.abs(option.commercialTerms.signedDiscount) * 1000) / 10;

  return (
    <>
      <ProposalMetaCard />
      <div className="panel panel-pad">
        <div className="panel-title">Параметры и расчёты</div>
        <div className="demo-calc-label" style={{ marginBottom: 12 }}>
          Демонстрационный расчёт · извлечённые правила S08 · не live Excel
        </div>

        <div className="option-bar">
          <span className="demo-calc-label">Альтернативы:</span>
          <button
            type="button"
            className={`option-chip ${mode === 'subscription' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ALTERNATIVES_MODE', mode: 'subscription' })}
          >
            Только подписка
          </button>
          <button
            type="button"
            className={`option-chip ${mode === 'perpetual' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ALTERNATIVES_MODE', mode: 'perpetual' })}
          >
            Только бессрочная
          </button>
          <button
            type="button"
            className={`option-chip ${mode === 'both' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ALTERNATIVES_MODE', mode: 'both' })}
          >
            Обе альтернативы
          </button>
        </div>

        <div className="option-bar">
          <span className="demo-calc-label">Редактируется:</span>
          {state.proposal.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`option-chip ${o.id === option.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE_OPTION', optionId: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          {option.licenseType === 'subscription' ? (
            <div className="field">
              <label htmlFor="term-months">Срок подписки (мес.)</label>
              <select
                id="term-months"
                value={option.termMonths ?? 12}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_OPTION_TERMS',
                    optionId: option.id,
                    patch: { termMonths: Number(e.target.value) },
                  })
                }
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={36}>36</option>
              </select>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="adj-dir">Корректировка</label>
            <select
              id="adj-dir"
              value={direction}
              onChange={(e) => {
                const dir = e.target.value;
                const signed = dir === 'discount' ? pct / 100 : -(pct / 100);
                dispatch({
                  type: 'UPDATE_OPTION_TERMS',
                  optionId: option.id,
                  patch: { signedDiscount: signed },
                });
              }}
            >
              <option value="discount">Скидка</option>
              <option value="markup">Наценка</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="adj-pct">Величина, %</label>
            <input
              id="adj-pct"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={pct}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                const signed = direction === 'discount' ? v / 100 : -(v / 100);
                dispatch({
                  type: 'UPDATE_OPTION_TERMS',
                  optionId: option.id,
                  patch: { signedDiscount: signed },
                });
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="adj-reason">Причина корректировки</label>
            <input
              id="adj-reason"
              value={option.commercialTerms.adjustmentReason ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_OPTION_TERMS',
                  optionId: option.id,
                  patch: { adjustmentReason: e.target.value || null },
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="support-extra">Доп. годы поддержки</label>
            <input
              id="support-extra"
              type="number"
              min={0}
              value={option.commercialTerms.supportExtraYears}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_OPTION_TERMS',
                  optionId: option.id,
                  patch: { supportExtraYears: Math.max(0, Number(e.target.value) || 0) },
                })
              }
            />
            <div className="demo-calc-label">Первый год включён; доп. годы → needs_rule в демо</div>
          </div>
        </div>

        <h3 style={{ marginTop: 20 }}>Строки расчёта — {option.label}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="calc-table">
            <thead>
              <tr>
                <th>Артикул</th>
                <th>Позиция</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
                <th>НДС</th>
              </tr>
            </thead>
            <tbody>
              {(option.calculation?.items ?? []).map((line) => (
                <tr key={line.id}>
                  <td>{line.sku ?? 'Не уточнён'}</td>
                  <td>{line.description}</td>
                  <td>
                    {line.saleQuantity}
                    {line.saleUnit === 'package' && line.packageCapacity
                      ? ` (пакет ${line.packageCapacity})`
                      : ''}
                  </td>
                  <td>{line.unitPrice != null ? formatMoneyPlain(line.unitPrice) : 'Требуется уточнение'}</td>
                  <td>{line.lineTotal != null ? formatMoneyPlain(line.lineTotal) : '—'}</td>
                  <td>
                    {line.tax.mode === 'exempt'
                      ? 'не облагается'
                      : line.tax.mode === 'included'
                        ? `в т.ч. ${formatMoneyPlain(line.tax.amount)}`
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="summary-row" style={{ marginTop: 16 }}>
          <div>
            {option.calculation?.status === 'complete' ? 'Итого' : 'Частичная сумма / статус'}:{' '}
            <strong>{option.calculation?.status}</strong>
          </div>
          <div className="sum">{formatOptionTotal(option.id)}</div>
        </div>

        <h3>Все альтернативы (не суммируются)</h3>
        {state.proposal.options.map((o, i) => (
          <div className="summary-row" key={o.id}>
            <div>
              Таблица {i + 1}: {o.label}
            </div>
            <div className="sum">{formatOptionTotal(o.id)}</div>
          </div>
        ))}

        {(option.calculation?.issues ?? []).length > 0 ? (
          <>
            <h3>Замечания</h3>
            <ul>
              {option.calculation!.issues.map((iss, idx) => (
                <li key={`${iss.code}-${idx}`}>{iss.message}</li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="summary-text">
          Лицензии: {formatMoney(option.calculation?.totals.exemptAmount)} без НДС.
          {Number(option.calculation?.totals.taxableGrossAmount ?? 0) > 0
            ? ` Комплект: ${formatMoney(option.calculation?.totals.taxableGrossAmount)} (НДС в т.ч. ${formatMoney(option.calculation?.totals.includedTaxAmount)}).`
            : ''}
        </div>
      </div>
    </>
  );
}
