import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteContribution, deleteSavingsGoal, getSavingsGoal, listContributions } from "../api/savingsGoals";
import type { SavingsContribution, SavingsGoal } from "../api/types";
import ContributionModal from "../components/ContributionModal";
import { ChevronLeftIcon, CloseIcon, PlusIcon } from "../components/Icons";
import PaceBadge from "../components/PaceBadge";
import SavingsProgressChart from "../components/charts/SavingsProgressChart";
import { formatCLP, formatShortDate } from "../utils/format";
import { computePace, computeRoute, formatLongDate } from "../utils/savings";

export default function SavingsGoalDetailPage() {
  const { id } = useParams();
  const goalId = Number(id);
  const navigate = useNavigate();
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const goalData = await getSavingsGoal(goalId);
      setGoal(goalData);
      setContributions(goalData.account ? [] : await listContributions(goalId));
    } catch {
      setError("No se encontró la meta.");
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteContribution(c: SavingsContribution) {
    const label = c.amount >= 0 ? "abono" : "retiro";
    if (!window.confirm(`¿Eliminar este ${label} de ${formatCLP(Math.abs(c.amount))}?`)) return;
    await deleteContribution(goalId, c.id);
    await load();
  }

  async function handleDeleteGoal() {
    if (!goal || !window.confirm(`¿Eliminar la meta "${goal.name}" y todo su historial?`)) return;
    await deleteSavingsGoal(goal.id);
    navigate("/ahorros");
  }

  if (loading) return <div className="page">Cargando...</div>;
  if (error || !goal) return <div className="page error">{error ?? "No se encontró la meta."}</div>;

  const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
  const route = computeRoute(goal);
  const pace = computePace(goal);
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
  const isManual = !goal.account;
  const newestFirst = [...contributions].reverse();

  return (
    <div className="page">
      <Link to="/ahorros" className="back-link back-link-icon">
        <ChevronLeftIcon /> Metas de ahorro
      </Link>

      <div className="page-header">
        <div>
          <p className="page-eyebrow">
            Meta para el {formatLongDate(goal.target_date)}
            {goal.account && <> · en {goal.account.name}</>}
          </p>
          <h1>{goal.name}</h1>
        </div>
        <div className="page-header-actions">
          {isManual && (
            <button type="button" className="button-primary" onClick={() => setModalOpen(true)}>
              <PlusIcon />
              Ingresar abono
            </button>
          )}
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-header">Ahorrado</div>
          <div className="kpi-value">{formatCLP(goal.current_amount)}</div>
          <span className="kpi-delta kpi-delta-neutral">{Math.round(pct)}% de la meta</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-header">Te falta</div>
          <div className="kpi-value">{formatCLP(remaining)}</div>
          <span className="kpi-delta kpi-delta-neutral">de {formatCLP(goal.target_amount)}</span>
        </div>
        <div className="kpi-card kpi-card-dark">
          <div className="kpi-header">Tu ritmo</div>
          <div className="kpi-pace">
            <PaceBadge pace={pace} />
          </div>
          <span className="kpi-delta kpi-delta-accent">
            {pace.kind === "behind" && `Abona ${formatCLP(pace.diff)} extra para ponerte al día`}
            {pace.kind === "ahead" && "Sigue así: vas mejor que el plan"}
            {pace.kind === "on_track" && "Lo que llevas coincide con el plan"}
            {pace.kind === "achieved" && "Llegaste a tu meta"}
            {pace.kind === "expired" && "Ajusta la fecha o el monto de tu meta"}
          </span>
        </div>
      </div>

      <div className="goal-progress-track" aria-hidden="true">
        <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {route.kind === "plan" && (
        <section className="card">
          <div className="card-header">
            <h2>¿Cuánto ahorrar desde hoy?</h2>
            <span className="cell-muted">Quedan {route.daysLeft} días</span>
          </div>
          <div className="goal-route-options">
            <div className="goal-route-option">
              <span className="goal-route-option-label">Por día</span>
              <span className="goal-route-option-value">{formatCLP(route.daily)}</span>
            </div>
            <div className="goal-route-option">
              <span className="goal-route-option-label">Por semana</span>
              <span className="goal-route-option-value">{formatCLP(route.weekly)}</span>
            </div>
            <div className="goal-route-option">
              <span className="goal-route-option-label">Por mes</span>
              <span className="goal-route-option-value">{formatCLP(route.monthly)}</span>
            </div>
          </div>
          <p className="field-hint">Elige el ritmo que mejor calce con cómo recibes tu plata.</p>
        </section>
      )}

      {isManual && (
        <section className="card">
          <div className="card-header">
            <h2>Tu avance vs. el plan</h2>
          </div>
          {contributions.length === 0 ? (
            <p className="empty-state">Ingresa tu primer abono para ver tu avance aquí.</p>
          ) : (
            <SavingsProgressChart goal={goal} contributions={contributions} />
          )}
        </section>
      )}

      {isManual ? (
        <section className="card">
          <div className="card-header">
            <h2>Historial de abonos</h2>
            <span className="cell-muted">
              {contributions.length} {contributions.length === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>
          {contributions.length === 0 ? (
            <p className="empty-state">Aún no hay abonos.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nota</th>
                    <th className="align-right">Monto</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-muted">{formatShortDate(c.date)}</td>
                      <td>{c.note || (c.amount >= 0 ? "Abono" : "Retiro")}</td>
                      <td className={`align-right ${c.amount >= 0 ? "amount-income" : "amount-expense"}`}>
                        {c.amount >= 0 ? "+" : "-"}
                        {formatCLP(Math.abs(c.amount))}
                      </td>
                      <td className="align-right">
                        <button
                          type="button"
                          className="icon-button icon-button-danger"
                          aria-label={`Eliminar ${c.amount >= 0 ? "abono" : "retiro"} del ${formatShortDate(c.date)}`}
                          title="Eliminar"
                          onClick={() => handleDeleteContribution(c)}
                        >
                          <CloseIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="card">
          <h2>¿De dónde sale el avance?</h2>
          <p className="cell-muted">
            Esta meta usa el saldo de tu cuenta <strong>{goal.account?.name}</strong>. Para avanzar, registra ingresos
            en esa cuenta.
          </p>
          <Link to={`/accounts/${goal.account?.id}`} className="card-link">
            Ver movimientos de la cuenta →
          </Link>
        </section>
      )}

      <button type="button" className="link-button goal-delete" onClick={handleDeleteGoal}>
        Eliminar meta
      </button>

      {modalOpen && <ContributionModal goal={goal} onClose={() => setModalOpen(false)} onCreated={load} />}
    </div>
  );
}
