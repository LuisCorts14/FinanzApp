import { useState } from "react";
import type { CategoryTotal } from "../../api/stats";
import { formatCLP } from "../../utils/format";
import CategoryDonutCard from "./CategoryDonutCard";

type View = "bars" | "donut" | "table";

const VIEWS: { value: View; label: string }[] = [
  { value: "bars", label: "Barras" },
  { value: "donut", label: "Círculo" },
  { value: "table", label: "Tabla" },
];

export default function ExpensesByCategoryChart({ data }: { data: CategoryTotal[] }) {
  const [view, setView] = useState<View>("bars");
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="empty-state">Aún no registras gastos este mes.</p>;
  }

  const max = Math.max(...data.map((d) => d.total));
  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div>
      <div className="segmented segmented-inline chart-view-tabs" role="tablist" aria-label="Tipo de vista">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            className={view === v.value ? "active" : ""}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "table" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="align-right">% del total</th>
                <th className="align-right">Gastado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.category_id}>
                  <td className="cell-strong">{d.category_name}</td>
                  <td className="align-right cell-muted">{Math.round((d.total / total) * 100)}%</td>
                  <td className="align-right">{formatCLP(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "donut" && <CategoryDonutCard data={data} />}

      {view === "bars" && (
        <div className="hbar-chart">
          {data.map((d) => {
            const pct = (d.total / max) * 100;
            const isHovered = hovered === d.category_id;
            return (
              <div
                className="hbar-row"
                key={d.category_id}
                onMouseEnter={() => setHovered(d.category_id)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="hbar-label" title={d.category_name}>
                  {d.category_name}
                </span>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{ width: `${pct}%`, opacity: isHovered ? 0.85 : 1 }}
                    role="img"
                    aria-label={`${d.category_name}: ${formatCLP(d.total)}`}
                  />
                  {isHovered && (
                    <div className="hbar-tooltip" style={{ left: `calc(${pct}% + 8px)` }}>
                      <strong>{formatCLP(d.total)}</strong>
                      <span>
                        {d.category_name} · {Math.round((d.total / total) * 100)}% del total
                      </span>
                    </div>
                  )}
                </div>
                <span className="hbar-value">{formatCLP(d.total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
