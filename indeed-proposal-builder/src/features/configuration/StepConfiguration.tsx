import { useMemo, useState } from 'react';
import { useBuilder } from '../../app/BuilderProvider';
import { ProposalMetaCard } from '../../components/layout/AppShell';
import { IconCopy, IconInfo, IconSearch, IconTrash } from '../../components/ui/Icons';
import { normalizeRequest } from '../../domain/normalizeRequest';
import { PRODUCT_NAMES } from '../../data/products';
import { formatMoney } from '../../domain/money';
import { describeStructure } from '../../domain/buildProposalDocument';
import type { Configuration, Metric, Platform } from '../../domain/types';
import { getCatalogItem } from '../../services/catalogService';

const QUICK = ['PAM', 'FSTEC', '25 пользователей', 'AM', 'WL', 'ADFS', 'AAPM'] as const;

export function StepConfiguration() {
  const { state, dispatch, formatOptionTotal, activeOption } = useBuilder();
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [infoId, setInfoId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const candidate = state.ui.parseCandidate;
  const option = activeOption;
  const configs = option?.configurations ?? [];
  const structure = useMemo(() => describeStructure(state.proposal), [state.proposal]);

  function runParse(text?: string) {
    const raw = text ?? state.proposal.rawRequest;
    const result = normalizeRequest(raw);
    dispatch({ type: 'SET_PARSE_CANDIDATE', candidate: result });
    dispatch({ type: 'SET_RAW_REQUEST', value: raw });
  }

  function appendQuick(token: string) {
    const next =
      token === '25 пользователей'
        ? `${state.proposal.rawRequest} 25 пользователей`.trim()
        : `${state.proposal.rawRequest} ${token}`.trim();
    dispatch({ type: 'SET_RAW_REQUEST', value: next });
  }

  if (!option) return null;

  return (
    <>
      <ProposalMetaCard />
      <div className="work-card">
        <div className="panel panel-pad">
          <div className="panel-title">Продукты и конфигурация</div>
          <div className="option-bar">
            <span className="demo-calc-label">Редактируется альтернатива:</span>
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

          <div className="search-line">
            <input
              aria-label="Свободный ввод запроса"
              placeholder="Введите ключевые слова продуктов, опций и параметров"
              value={state.proposal.rawRequest}
              onChange={(e) => dispatch({ type: 'SET_RAW_REQUEST', value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runParse();
                }
              }}
            />
            <div className="chips-inline">
              {(candidate?.tokens ?? [])
                .filter((t) => t.kind !== 'unknown')
                .slice(0, 8)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip ${t.ambiguous ? 'ambiguous' : ''}`}
                    onClick={() => {
                      // Removing chip adjusts candidate by re-parsing without that label is hard;
                      // remove from raw text occurrence
                      const next = state.proposal.rawRequest.replace(new RegExp(t.label, 'i'), '').replace(/\s+/g, ' ').trim();
                      dispatch({ type: 'SET_RAW_REQUEST', value: next });
                      runParse(next);
                    }}
                    title="Удалить из запроса"
                  >
                    {t.label} <span aria-hidden>×</span>
                  </button>
                ))}
              {(candidate?.unrecognized ?? []).map((u) => (
                <span key={u} className="chip unknown">
                  {u}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="icon-btn"
                aria-label="Очистить запрос"
                onClick={() => {
                  dispatch({ type: 'SET_RAW_REQUEST', value: '' });
                  dispatch({ type: 'SET_PARSE_CANDIDATE', candidate: null });
                }}
              >
                ×
              </button>
              <button type="button" className="icon-btn" aria-label="Распознать" onClick={() => runParse()}>
                <IconSearch />
              </button>
            </div>
          </div>
          <div className="hint">Примеры: PAM25 FSTEC, AM WL RDP LDAP SSO 150, AAPM 50</div>
          {candidate?.conflicts.length || candidate?.questions.length ? (
            <div className="hint" style={{ color: '#b45309' }}>
              {[...(candidate.conflicts ?? []), ...(candidate.questions ?? [])].join(' · ')}
            </div>
          ) : null}
          {candidate && candidate.products.length > 0 ? (
            <button type="button" className="add-inline" style={{ marginBottom: 10 }} onClick={() => dispatch({ type: 'APPLY_CANDIDATE' })}>
              Применить распознанные параметры
            </button>
          ) : null}

          <div className="quick-title">Популярные продукты и опции</div>
          <div className="quick-row">
            {QUICK.map((q) => (
              <button key={q} type="button" className={`quick ${q.includes('пользовател') ? 'big' : ''}`} onClick={() => appendQuick(q)}>
                {q}
              </button>
            ))}
          </div>

          <div className="products-box">
            <div className="box-head">
              <div className="box-head-title">
                Определённые продукты <span>{configs.length} продукт(ов)</span>
              </div>
              <div style={{ position: 'relative' }}>
                <button type="button" className="add-inline" onClick={() => setAddOpen((v) => !v)}>
                  ＋ Добавить
                </button>
                {addOpen ? (
                  <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', border: '1px solid #d9dee8', borderRadius: 8, zIndex: 5, minWidth: 140 }}>
                    {(['PAM', 'AM', 'CM', 'ITDR'] as const).map((code) => (
                      <button
                        key={code}
                        type="button"
                        className="add-inline"
                        style={{ width: '100%', border: 0, borderRadius: 0 }}
                        onClick={() => {
                          dispatch({ type: 'ADD_PRODUCT', product: code });
                          setAddOpen(false);
                        }}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {configs.length === 0 ? (
              <div className="product-table-card hint">Нет продуктов. Добавьте через поиск или кнопку «Добавить».</div>
            ) : null}

            {configs.map((cfg) => (
              <ProductCard
                key={cfg.id}
                cfg={cfg}
                optionId={option.id}
                option={option}
                draftQty={draftQty[cfg.id] ?? String(cfg.quantity || '')}
                onDraftQty={(v) => setDraftQty((d) => ({ ...d, [cfg.id]: v }))}
                onCommitQty={(n) => {
                  dispatch({
                    type: 'UPDATE_CONFIGURATION',
                    optionId: option.id,
                    configurationId: cfg.id,
                    patch: { quantity: n },
                  });
                }}
                onInfo={() => setInfoId(cfg.id)}
              />
            ))}
          </div>
        </div>

        <div className="panel summary-panel">
          <div className="summary-title">Итого по продуктам</div>
          {state.proposal.options.map((o, idx) => (
            <div className="summary-row" key={o.id}>
              <div>
                Таблица {idx + 1} ({o.label})
              </div>
              <div className="sum">{formatOptionTotal(o.id)}</div>
            </div>
          ))}
          <div className="summary-row">
            <div>НДС</div>
            <div className="sum red">{vatSummary(state)}</div>
          </div>
          <div className="summary-divider" />
          <div className="summary-text">Итоговые суммы в КП приводятся по каждой таблице отдельно.</div>
          <div className="summary-text">ФСТЭК-комплект указывается отдельной строкой; НДС отражается в примечании.</div>
          <div className="demo-calc-label">Демонстрационный расчёт · mode=demo</div>
        </div>
      </div>

      <div className="panel structure-panel">
        <div className="sub-title">Структура КП и расчёты</div>
        <div className="structure-subtitle">Проверьте, какие разделы попадут в документ и как будут сформированы таблицы.</div>
        <div className="structure-scroll">
          <table className="structure-table">
            <tbody>
              {structure.map((s) => (
                <tr key={s.num}>
                  <td className="section-num">{s.num}</td>
                  <td className="structure-main">
                    <strong>{s.title}</strong>
                    <span>{s.detail}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${s.status === 'warn' ? 'warn' : 'on'}`}>
                      {s.status === 'warn' ? 'Уточнить' : 'Включено'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {infoId ? (
        <div className="dialog-backdrop" onClick={() => setInfoId(null)}>
          <div className="dialog" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>О продукте</h2>
            <ProductInfo cfg={configs.find((c) => c.id === infoId)!} />
            <div className="dialog-actions">
              <button type="button" className="bottom-btn" onClick={() => setInfoId(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function vatSummary(state: ReturnType<typeof useBuilder>['state']): string {
  let hasExempt = false;
  let hasKit = false;
  let kitVat = 0;
  for (const o of state.proposal.options) {
    for (const line of o.calculation?.items ?? []) {
      if (line.tax.mode === 'exempt') hasExempt = true;
      if (line.itemId === 'PAM.FSTEC_KIT') {
        hasKit = true;
        kitVat += Number(line.tax.amount ?? 0);
      }
    }
  }
  if (hasKit && hasExempt) return `лицензии без НДС; комплект — НДС в т.ч. ${formatMoney(kitVat)}`;
  if (hasKit) return `НДС в т.ч. ${formatMoney(kitVat)}`;
  if (hasExempt) return 'не облагается';
  return '—';
}

function ProductInfo({ cfg }: { cfg: Configuration }) {
  return (
    <div>
      <p>
        <strong>{cfg.product}</strong> — {PRODUCT_NAMES[cfg.product]}
      </p>
      <p>
        Метрика: {cfg.metric}, количество: {cfg.quantity}, сертификация:{' '}
        {cfg.certified === true ? 'да' : cfg.certified === false ? 'нет' : 'не уточнено'}
      </p>
      {cfg.modules.map((m) => (
        <p key={m.id}>
          Модуль {getCatalogItem(m.itemId)?.label ?? m.itemId}: {m.quantity}
        </p>
      ))}
    </div>
  );
}

function ProductCard({
  cfg,
  optionId,
  option,
  draftQty,
  onDraftQty,
  onCommitQty,
  onInfo,
}: {
  cfg: Configuration;
  optionId: string;
  option: NonNullable<ReturnType<typeof useBuilder>['activeOption']>;
  draftQty: string;
  onDraftQty: (v: string) => void;
  onCommitQty: (n: number) => void;
  onInfo: () => void;
}) {
  const { dispatch } = useBuilder();
  const certLabel =
    cfg.certified === true
      ? 'Сертифицированная версия (ФСТЭК)'
      : cfg.certified === false
        ? 'Обычная версия'
        : 'Не уточнено';

  return (
    <div className="product-card product-table-card">
      <div className="table-product-header">
        <button
          type="button"
          className={`check-square ${cfg.enabled ? '' : 'off'}`}
          aria-pressed={cfg.enabled}
          aria-label={cfg.enabled ? 'Исключить из альтернативы' : 'Включить в альтернативу'}
          onClick={() => dispatch({ type: 'TOGGLE_CONFIGURATION', optionId, configurationId: cfg.id })}
        >
          ✓
        </button>
        <div className="table-product-main">
          <div className="table-product-title">
            {cfg.product} <span>{PRODUCT_NAMES[cfg.product]}</span>
          </div>
        </div>
        {cfg.certified === true ? <div className="purple-chip">{certLabel}</div> : <div />}
        <div className="product-actions compact">
          <button type="button" aria-label="Справка" onClick={onInfo}>
            <IconInfo />
          </button>
          <button
            type="button"
            aria-label="Дублировать"
            onClick={() => dispatch({ type: 'DUPLICATE_CONFIGURATION', optionId, configurationId: cfg.id })}
          >
            <IconCopy />
          </button>
          <button
            type="button"
            aria-label="Удалить"
            onClick={() => dispatch({ type: 'REMOVE_CONFIGURATION', optionId, configurationId: cfg.id })}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <div className="product-params-scroll">
        <table className="updated-param-table">
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Значение</th>
              <th>Как попадёт в КП</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>
                  {cfg.product === 'PAM'
                    ? cfg.metric === 'concurrent_sessions'
                      ? 'Количество одновременных подключений'
                      : cfg.metric === 'resources'
                        ? 'Количество ресурсных лицензий'
                        : 'Количество пользователей'
                    : 'Количество'}
                </strong>
              </td>
              <td>
                <input
                  className="value-control"
                  inputMode="numeric"
                  value={draftQty}
                  aria-label="Количество"
                  onChange={(e) => onDraftQty(e.target.value)}
                  onBlur={() => {
                    const n = Number(draftQty);
                    if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) onCommitQty(n);
                  }}
                />
              </td>
              <td>Используется в заголовке расчёта и подборе артикула</td>
            </tr>

            {cfg.product === 'PAM' ? (
              <tr>
                <td>
                  <strong>Метрика лицензирования</strong>
                </td>
                <td>
                  <select
                    className="value-control"
                    value={cfg.metric}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_CONFIGURATION',
                        optionId,
                        configurationId: cfg.id,
                        patch: { metric: e.target.value as Metric },
                      })
                    }
                  >
                    <option value="users">Пользователи (UL)</option>
                    <option value="concurrent_sessions">Одновременные подключения (CS)</option>
                    <option value="resources">Ресурсы (RL)</option>
                  </select>
                </td>
                <td>Определяет текст позиции и единицу расчёта</td>
              </tr>
            ) : null}

            {cfg.product === 'CM' ? (
              <tr>
                <td>
                  <strong>Платформа</strong>
                </td>
                <td>
                  <select
                    className="value-control"
                    value={cfg.platform ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_CONFIGURATION',
                        optionId,
                        configurationId: cfg.id,
                        patch: { platform: (e.target.value || null) as Platform },
                      })
                    }
                  >
                    <option value="">Не уточнено</option>
                    <option value="windows">Windows</option>
                    <option value="multiplatform">Мультиплатформа</option>
                  </select>
                </td>
                <td>Влияет на каталог модулей и ветку расчёта</td>
              </tr>
            ) : null}

            <tr>
              <td>
                <strong>Сертификация</strong>
              </td>
              <td>
                <select
                  className="value-control"
                  value={cfg.certified === true ? 'yes' : cfg.certified === false ? 'no' : 'unset'}
                  onChange={(e) => {
                    const v = e.target.value;
                    const certified = v === 'yes' ? true : v === 'no' ? false : null;
                    const kitQuantity = certified === true && cfg.kitQuantity === 0 ? 1 : certified === false ? 0 : cfg.kitQuantity;
                    dispatch({
                      type: 'UPDATE_CONFIGURATION',
                      optionId,
                      configurationId: cfg.id,
                      patch: { certified, kitQuantity },
                    });
                  }}
                >
                  <option value="unset">Не уточнено</option>
                  <option value="no">Обычная версия</option>
                  <option value="yes">Сертифицированная версия</option>
                </select>
              </td>
              <td>Добавляет коэффициент и при необходимости комплект ФСТЭК</td>
            </tr>

            {cfg.product === 'PAM' ? (
              <tr>
                <td>
                  <strong>Физический комплект ФСТЭК</strong>
                </td>
                <td>
                  <input
                    className="value-control"
                    type="number"
                    min={0}
                    value={cfg.kitQuantity}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_CONFIGURATION',
                        optionId,
                        configurationId: cfg.id,
                        patch: { kitQuantity: Math.max(0, Number(e.target.value) || 0) },
                      })
                    }
                  />
                </td>
                <td>Отдельная строка с НДС; не равна сертификационному коэффициенту</td>
              </tr>
            ) : null}

            <tr>
              <td>
                <strong>Вид лицензии</strong>
              </td>
              <td>
                <select
                  className="value-control"
                  value={option.licenseType}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_OPTION_TERMS',
                      optionId,
                      patch: {
                        licenseType: e.target.value as 'subscription' | 'perpetual',
                        termMonths: e.target.value === 'perpetual' ? null : option.termMonths ?? 12,
                      },
                    })
                  }
                >
                  <option value="subscription">Срочная (подписка)</option>
                  <option value="perpetual">Бессрочная</option>
                </select>
              </td>
              <td>Общий параметр альтернативы, не карточки</td>
            </tr>

            {option.licenseType === 'subscription' ? (
              <tr>
                <td>
                  <strong>Срок лицензии</strong>
                </td>
                <td>
                  <select
                    className="value-control"
                    value={option.termMonths ?? 12}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_OPTION_TERMS',
                        optionId,
                        patch: { termMonths: Number(e.target.value) },
                      })
                    }
                  >
                    <option value={6}>6 месяцев</option>
                    <option value={12}>12 месяцев</option>
                    <option value={24}>24 месяца</option>
                    <option value={36}>36 месяцев</option>
                  </select>
                </td>
                <td>Формирует таблицу срочных лицензий; иные сроки могут требовать правила</td>
              </tr>
            ) : null}

            <tr>
              <td>
                <strong>Дополнительные модули</strong>
              </td>
              <td>
                <ModulesEditor cfg={cfg} optionId={optionId} />
              </td>
              <td>Добавляются отдельными позициями</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModulesEditor({ cfg, optionId }: { cfg: Configuration; optionId: string }) {
  const { dispatch } = useBuilder();
  const suggestions =
    cfg.product === 'AM'
      ? ['AM.WINDOWS_LOGON', 'AM.LDAP_PROXY', 'AM.ADFS', 'AM.ESSO', 'AM.RDP_LOGON']
      : cfg.product === 'CM'
        ? ['CM.WINDOWS.AGENT']
        : cfg.product === 'PAM'
          ? ['PAM.AAPM', 'PAM.SQL_PROXY']
          : ['ITDR.MONITORING', 'ITDR.MFA'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {cfg.modules.length === 0 ? <span style={{ color: '#8a93a4' }}>Не выбраны</span> : null}
      {cfg.modules.map((m) => (
        <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{getCatalogItem(m.itemId)?.label ?? m.itemId}</span>
          <input
            className="value-control"
            style={{ width: 72 }}
            type="number"
            min={1}
            value={m.quantity}
            aria-label={`Количество ${m.itemId}`}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                dispatch({
                  type: 'UPDATE_MODULE',
                  optionId,
                  configurationId: cfg.id,
                  moduleId: m.id,
                  quantity: n,
                });
              }
            }}
          />
          <button
            type="button"
            className="add-inline"
            aria-label="Удалить модуль"
            onClick={() =>
              dispatch({ type: 'REMOVE_MODULE', optionId, configurationId: cfg.id, moduleId: m.id })
            }
          >
            ×
          </button>
        </div>
      ))}
      <select
        className="value-control"
        defaultValue=""
        onChange={(e) => {
          if (!e.target.value) return;
          dispatch({ type: 'ADD_MODULE', optionId, configurationId: cfg.id, itemId: e.target.value });
          e.target.value = '';
        }}
      >
        <option value="">＋ модуль…</option>
        {suggestions
          .filter((id) => !cfg.modules.some((m) => m.itemId === id))
          .map((id) => (
            <option key={id} value={id}>
              {getCatalogItem(id)?.label ?? id}
            </option>
          ))}
      </select>
    </div>
  );
}
