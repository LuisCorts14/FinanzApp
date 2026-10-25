import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAccounts } from "../api/accounts";
import { listSavingsGoals } from "../api/savingsGoals";
import type { Account, SavingsGoal } from "../api/types";
import ContributionModal from "../components/ContributionModal";
import GoalFormModal from "../components/GoalFormModal";
import { PlusIcon } from "../components/Icons";
import PaceBadge from "../components/PaceBadge";
import { formatCLP } from "../utils/format";
import { computePace, computeRoute, formatLongDate } from "../utils/savings";

export default function SavingsGoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [contributingTo, setContributingTo] = useState<SavingsGoal | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [goalsData, accountsData] = await Promise.all([listSavingsGoals(), listAccounts()]);
      setGoals(goalsData);
      setAccounts(accountsData);
    } catch {
      setError("No se pudo conectar con la API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Llevas {formatCLP(totalSaved)} ahorrados en tus metas</p>
          <h1>Metas de ahorro</h1>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-primary" onClick={() => setCreating(true)}>
            <PlusIcon />
            Nueva meta
          </button>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && goals.length === 0 && (
        <div className="card onboarding-card">
          <h2>Ahorrar es más fácil con una meta</h2>
          <p>
            Ponle nombre, monto y fecha a lo que quieres lograr. Te diremos cuánto apartar por día, semana o mes, y si
            vas al ritmo.
          </p>
        </div>
      )}

      <div className="goals-grid">
        {goals.map((goal) => {
          const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
          const route = computeRoute(goal);
          return (
            <div className="goal-card" key={goal.id}>
              <Link to={`/ahorros/${goal.id}`} className="goal-card-link">
                <div className="goal-card-header">
                  <h3>{goal.name}</h3>
                  <PaceBadge pace={computePace(goal)} />
                </div>
                <p className="goal-account">
                  {goal.account ? `Saldo de ${goal.account.name}` : "Con abonos"} · {formatLongDate(goal.target_date)}
                </p>

                <div className="goal-amounts">
                  <span className="goal-current">{formatCLP(goal.current_amount)}</span>
                  <span className="goal-target"> de {formatCLP(goal.target_amount)}</span>
                </div>
                <div className="goal-progress-track" aria-hidden="true">
                  <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {route.kind === "plan" && (
                  <p className="goal-route goal-route-info">
                    Aparta <strong>{formatCLP(route.weekly)}</strong> por semana o{" "}
                    <strong>{formatCLP(route.monthly)}</strong> por mes para llegar a tiempo.
                  </p>
                )}
              </Link>

              <div className="goal-card-actions">
                {!goal.account && (
                  <button type="button" className="button-secondary" onClick={() => setContributingTo(goal)}>
                    <PlusIcon /> Ingresar abono
                  </button>
                )}
                <Link to={`/ahorros/${goal.id}`} className="card-link">
                  Ver detalle →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {creating && <GoalFormModal accounts={accounts} onClose={() => setCreating(false)} onCreated={loadData} />}
      {contributingTo && (
        <ContributionModal goal={contributingTo} onClose={() => setContributingTo(null)} onCreated={loadData} />
      )}
    </div>
  );
}
