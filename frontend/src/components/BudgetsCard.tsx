import { Link } from "react-router-dom";
import type { BudgetStatus } from "../api/stats";
import { useSettings } from "../context/settingsContext";
import { budgetStatusFor } from "../utils/budget";
import { formatCLP } from "../utils/format";

const STATUS_ICON = { good: "✓", warning: "!", critical: "!" } as const;

export default function BudgetsCard({ data }: { data: BudgetStatus[] }) {
  const { settings } = useSettings();
  if (data.length === 0) {
    return (
      <p className="empty-state">
        Aún no tienes categorías con presupuesto. Ponle un límite mensual a tus gastos en{" "}
        <Link to="/categories">Categorías</Link>.
      </p>
    );
  }

  return (
    <div className="budgets-list">
      {data.map((b) => {
        const pct = b.monthly_budget > 0 ? (b.spent / b.monthly_budget) * 100 : 0;
        const status = budgetStatusFor(pct, settings.budget_alert_pct);
        const remaining = b.monthly_budget - b.spent;
        return (
          <div className="budget-row" key={b.category_id}>
            <div className="budget-row-header">
              <span className="budget-row-name">{b.category_name}</span>
              <span className="budget-row-amounts">
                {formatCLP(b.spent)} de {formatCLP(b.monthly_budget)}
              </span>
            </div>
            <div className="budget-track">
              <div className={`budget-fill budget-fill-${status}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className={`budget-row-note budget-note-${status}`}>
              <span aria-hidden="true">{STATUS_ICON[status]} </span>
              {remaining >= 0
                ? `Te quedan ${formatCLP(remaining)} (${Math.round(pct)}% usado)`
                : `Te pasaste por ${formatCLP(-remaining)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
