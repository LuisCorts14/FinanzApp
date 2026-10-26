import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDebt, getDebtPlan, saveDebtPlanSettings } from "../api/debts";
import type { DebtPlan, DebtStrategy, PlanDebt, PlanScenario } from "../api/types";
import DebtPlanChart from "../components/charts/DebtPlanChart";
import DebtFormModal from "../components/DebtFormModal";
import DebtPaymentModal from "../components/DebtPaymentModal";
import { CloseIcon, CreditCardIcon, PencilIcon, PlusIcon } from "../components/Icons";
import { DEBT_KIND_LABELS, formatDuration, formatRate, minimumBelowInterest, monthsFromNow } from "../utils/debts";
import { formatCLP } from "../utils/format";

const STRATEGIES: { id: DebtStrategy; label: string; hint: string }[] = [
  {
    id: "avalanche",
    label: "Avalancha",
    hint: "Primero la deuda con la tasa más alta. Es la que te hace pagar menos intereses.",
  },
  {
    id: "snowball",
    label: "Bola de nieve",
    hint: "Primero la deuda más chica. Terminas deudas antes y eso ayuda a no rendirse.",
  },
];

function PlanSummary({ plan, scenario, strategy }: { plan: DebtPlan; scenario: PlanScenario; strategy: DebtStrategy }) {
  const minimum = plan.minimum_only;
  const other = strategy === "avalanche" ? plan.snowball : plan.avalanche;
  const otherLabel = strategy === "avalanche" ? "bola de nieve" : "avalancha";

  if (scenario.status === "insufficient_budget") {
    return (
      <p className="debt-plan-alert">
        Con {formatCLP(plan.monthly_budget)} al mes no alcanzas a cubrir los pagos mínimos ({formatCLP(plan.total_minimum)}).
        Si no puedes pagar más, conversa con tu banco sobre repactar: atrasarse suma intereses y cobranza.
      </p>
    );
  }
  if (scenario.status === "never" || scenario.months === null) {
    return (
      <p className="debt-plan-alert">
        Con este monto las deudas no se terminan de pagar: los intereses crecen más rápido que tus pagos. Intenta con un
        monto mayor.
      </p>
    );
  }

  const savedInterest = minimum.status === "ok" ? minimum.total_interest - scenario.total_interest : null;
  const savedMonths = minimum.status === "ok" && minimum.months !== null ? minimum.months - scenario.months : null;

  return (
    <>
      <p className="debt-plan-headline">
        {scenario.months === 0 ? (
          "No tienes deudas pendientes. ¡Bien!"
        ) : (
          <>
            Quedarías libre de deudas en <strong>{formatDuration(scenario.months)}</strong>, en{" "}
            <strong>{monthsFromNow(scenario.months)}</strong>.
          </>
        )}
      </p>
      <div className="summary-strip debt-summary">
        <div className="summary-item">
          <span className="summary-label">Intereses que pagarías</span>
          <span className="summary-value">{formatCLP(scenario.total_interest)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total a pagar</span>
          <span className="summary-value">{formatCLP(scenario.total_paid)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Pagando solo el mínimo</span>
          <span className="summary-value">
            {minimum.status === "ok" && minimum.months !== null ? formatDuration(minimum.months) : "Nunca terminas"}
          </span>
        </div>
      </div>
      {savedInterest !== null && savedMonths !== null && (savedInterest > 0 || savedMonths > 0) && (
        <p className="debt-plan-saving">
          Frente a pagar solo el mínimo, te ahorras <strong>{formatCLP(savedInterest)}</strong> en intereses y terminas{" "}
          <strong>{formatDuration(savedMonths)}</strong> antes.
        </p>
      )}
      {minimum.status === "never" && (
        <p className="debt-plan-saving">
          Pagando solo el mínimo, al menos una deuda no se terminaría nunca: su mínimo no cubre los intereses.
        </p>
      )}
      {other.status === "ok" && other.months !== null && (
        <p className="field-hint">
          Con {otherLabel}: {formatDuration(other.months)} y {formatCLP(other.total_interest)} en intereses.
        </p>
      )}
    </>
  );
}

export default function DebtsPage() {
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [calculating, setCalculating] = useState(false);
  const [editing, setEditing] = useState<PlanDebt | "new" | null>(null);
  const [paying, setPaying] = useState<PlanDebt | null>(null);

  async function loadPlan(budget?: number) {
    setError(null);
    try {
      const data = await getDebtPlan(budget);
      setPlan(data);
      setBudgetInput(String(Math.round(data.monthly_budget)));
      if (budget === undefined) setStrategy(data.strategy);
    } catch {
      setError("No se pudo cargar tu plan de deudas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  // Al cambiar una deuda se recalcula con el monto que está escrito, no con el guardado.
  function reload() {
    loadPlan(Number(budgetInput) || undefined);
  }

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    const budget = Number(budgetInput);
    if (!budget || budget <= 0) return;
    setCalculating(true);
    try {
      await saveDebtPlanSettings(budget, strategy);
      await loadPlan(budget);
    } catch {
      setError("No se pudo guardar tu plan.");
    } finally {
      setCalculating(false);
    }
  }

  function handleStrategy(next: DebtStrategy) {
    setStrategy(next);
    // Solo guarda la estrategia: el monto se guarda al presionar "Calcular plan".
    saveDebtPlanSettings(plan?.budget_is_saved ? plan.monthly_budget : null, next).catch(() => {
      // Si no se guarda, el cambio igual se ve en pantalla.
    });
  }

  async function handleDelete(debt: PlanDebt) {
    if (!window.confirm(`¿Eliminar "${debt.name}"? Hazlo solo si ya no la debes o la registraste por error.`)) return;
    try {
      await deleteDebt(debt.id);
      reload();
    } catch {
      setError("No se pudo eliminar la deuda.");
    }
  }

  const debts = plan?.debts ?? [];
  const scenario = plan ? plan[strategy] : null;
  const incomplete = debts.filter((d) => !d.included);
  // A qué deuda va hoy el pago extra (el mismo orden que usa el backend para simular).
  const firstTarget = [...debts]
    .filter((d) => d.included)
    .sort((a, b) =>
      strategy === "avalanche"
        ? (b.interest_rate ?? 0) - (a.interest_rate ?? 0) || a.balance - b.balance
        : a.balance - b.balance || (b.interest_rate ?? 0) - (a.interest_rate ?? 0),
    )[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">
            {plan && debts.length > 0
              ? `Debes ${formatCLP(plan.total_balance)} en ${debts.length} ${debts.length === 1 ? "deuda" : "deudas"}`
              : "Ordena tus deudas y sal de ellas con un plan"}
          </p>
          <h1>Plan de deudas</h1>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-primary" onClick={() => setEditing("new")}>
            <PlusIcon />
            Agregar deuda
          </button>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && plan && debts.length === 0 && (
        <div className="card onboarding-card">
          <h2>Sin deudas por ahora</h2>
          <p>
            Tus tarjetas de crédito con saldo en contra aparecen aquí solas. Agrega también créditos de consumo,
            avances o préstamos, y te diremos en qué orden pagarlos y cuándo quedarías libre.
          </p>
        </div>
      )}

      {plan && debts.length > 0 && scenario && (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-header">
                <span>Deuda total</span>
                <span className="kpi-icon kpi-icon-expense">
                  <CreditCardIcon />
                </span>
              </div>
              <div className="kpi-value">{formatCLP(plan.total_balance)}</div>
              <span className="kpi-delta kpi-delta-neutral">Tarjetas y otras deudas</span>
            </div>
            <div className="kpi-card">
              <div className="kpi-header">
                <span>Pagos mínimos al mes</span>
              </div>
              <div className="kpi-value">{formatCLP(plan.total_minimum)}</div>
              <span className="kpi-delta kpi-delta-neutral">Lo mínimo para no atrasarte</span>
            </div>
            <div className="kpi-card kpi-card-dark">
              <div className="kpi-header">
                <span>Intereses de este mes</span>
              </div>
              <div className="kpi-value">{formatCLP(plan.monthly_interest)}</div>
              <span className="kpi-delta kpi-delta-warn">Plata que se va sin bajar tu deuda</span>
            </div>
          </div>

          <section className="card">
            <div className="card-header">
              <h2>Tus deudas</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Deuda</th>
                    <th className="align-right">Saldo</th>
                    <th className="align-right">Tasa mensual</th>
                    <th className="align-right">Pago mínimo</th>
                    <th className="align-right">Interés del mes</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => (
                    <tr key={d.key}>
                      <td>
                        <div className="debt-name">{d.name}</div>
                        <div className="cell-muted">{DEBT_KIND_LABELS[d.kind]}</div>
                        {minimumBelowInterest(d) && (
                          <div className="debt-warning">El mínimo no cubre los intereses: la deuda crece.</div>
                        )}
                      </td>
                      <td className="align-right">{formatCLP(d.balance)}</td>
                      <td className="align-right">{d.interest_rate !== null ? formatRate(d.interest_rate) : "—"}</td>
                      <td className="align-right">{d.minimum_payment !== null ? formatCLP(d.minimum_payment) : "—"}</td>
                      <td className="align-right">{d.included ? formatCLP(d.monthly_interest) : "—"}</td>
                      <td className="align-right">
                        <div className="row-actions">
                          {d.source === "card" ? (
                            <>
                              <button
                                type="button"
                                className={d.included ? "icon-button icon-button-sm" : "button-secondary button-sm"}
                                aria-label={`Editar tasa y pago mínimo de ${d.name}`}
                                title="Tasa y pago mínimo"
                                onClick={() => setEditing(d)}
                              >
                                {d.included ? <PencilIcon /> : "Completar datos"}
                              </button>
                              <Link to={`/accounts/${d.id}`} className="card-link">
                                Pagar
                              </Link>
                            </>
                          ) : (
                            <>
                              <button type="button" className="button-secondary button-sm" onClick={() => setPaying(d)}>
                                Registrar pago
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button-sm"
                                aria-label={`Editar ${d.name}`}
                                title="Editar"
                                onClick={() => setEditing(d)}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button-sm icon-button-danger"
                                aria-label={`Eliminar ${d.name}`}
                                title="Eliminar"
                                onClick={() => handleDelete(d)}
                              >
                                <CloseIcon />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {incomplete.length > 0 && (
              <p className="field-hint">
                {incomplete.length === 1 ? "Una tarjeta no está" : `${incomplete.length} tarjetas no están`} en el plan
                porque falta su tasa o su pago mínimo. Usa "Completar datos".
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-header card-header-wrap">
              <h2>Tu plan</h2>
              <div className="segmented segmented-inline" role="group" aria-label="Estrategia">
                {STRATEGIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={strategy === s.id ? "active" : ""}
                    aria-pressed={strategy === s.id}
                    onClick={() => handleStrategy(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="field-hint">{STRATEGIES.find((s) => s.id === strategy)?.hint}</p>

            <form className="debt-budget-form" onSubmit={handleCalculate}>
              <label>
                ¿Cuánto puedes destinar al mes a pagar deudas?
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="button-primary" disabled={calculating}>
                {calculating ? "Calculando..." : "Calcular plan"}
              </button>
            </form>
            {!plan.budget_is_saved && (
              <p className="field-hint">
                Partimos con la suma de tus pagos mínimos. Prueba con un poco más y mira cuánto cambia.
              </p>
            )}

            <PlanSummary plan={plan} scenario={scenario} strategy={strategy} />

            {scenario.status === "ok" && scenario.payoffs.length > 0 && (
              <>
                {firstTarget && scenario.payoffs.length > 1 && plan.monthly_budget > plan.total_minimum && (
                  <p className="debt-plan-how">
                    Cada mes paga el mínimo de todas y lo que te sobre ponlo en <strong>{firstTarget.name}</strong>.
                    Cuando la termines, ese dinero pasa a la siguiente.
                  </p>
                )}
                <ol className="debt-order">
                  {scenario.payoffs.map((p) => (
                    <li key={p.key}>
                      <span>{p.name}</span>
                      <span className="cell-muted">
                        pagada en {monthsFromNow(p.month)} · mes {p.month}
                      </span>
                    </li>
                  ))}
                </ol>
                <DebtPlanChart plan={scenario} minimumOnly={plan.minimum_only} />
              </>
            )}
            <p className="field-hint">
              Es una estimación: supone que no sumas deudas nuevas y que las tasas no cambian.
            </p>
          </section>
        </>
      )}

      {editing && (
        <DebtFormModal debt={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
      {paying && <DebtPaymentModal debt={paying} onClose={() => setPaying(null)} onSaved={reload} />}
    </div>
  );
}
