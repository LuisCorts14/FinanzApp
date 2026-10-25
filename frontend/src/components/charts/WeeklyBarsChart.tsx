import type { WeeklySummary } from "../../api/stats";
import { formatCLP } from "../../utils/format";

export default function WeeklyBarsChart({ data }: { data: WeeklySummary[] }) {
  const max = Math.max(0, ...data.flatMap((w) => [w.income, w.expense]));

  if (max === 0) {
    return <p className="empty-state">Aún no hay movimientos este mes.</p>;
  }

  const height = (value: number) => `${(value / max) * 100}%`;

  return (
    <div className="weekly-chart">
      <div className="weekly-bars">
        {data.map((w) => (
          <div key={w.week} className="weekly-group">
            <div className="weekly-group-bars">
              <div
                className="weekly-bar weekly-bar-income"
                style={{ height: height(w.income) }}
                title={`Ingresos días ${w.start_day}–${w.end_day}: ${formatCLP(w.income)}`}
              />
              <div
                className="weekly-bar weekly-bar-expense"
                style={{ height: height(w.expense) }}
                title={`Gastos días ${w.start_day}–${w.end_day}: ${formatCLP(w.expense)}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="weekly-labels">
        {data.map((w) => (
          <span key={w.week} title={`Días ${w.start_day}–${w.end_day}`}>
            Sem {w.week}
          </span>
        ))}
      </div>
    </div>
  );
}
