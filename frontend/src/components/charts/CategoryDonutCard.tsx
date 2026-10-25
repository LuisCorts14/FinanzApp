import type { CategoryTotal } from "../../api/stats";
import { formatCLP } from "../../utils/format";

// Mismo orden de colores que el diseño del dashboard; "Otros" siempre en gris.
const PALETTE = ["#0f7d5c", "#e2733a", "#3b82c6", "#8f6bd6", "#e0a526", "#d9668f"];
const OTHERS_COLOR = "#b9bdc3";
const MAX_SLICES = 5;

export default function CategoryDonutCard({ data }: { data: CategoryTotal[] }) {
  if (data.length === 0) {
    return <p className="empty-state">Aún no registras gastos este mes.</p>;
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  let items = sorted.map((d, i) => ({ name: d.category_name, value: d.total, color: PALETTE[i] }));

  if (items.length > MAX_SLICES) {
    const head = items.slice(0, MAX_SLICES - 1);
    const tailTotal = items.slice(MAX_SLICES - 1).reduce((sum, d) => sum + d.value, 0);
    items = [...head, { name: "Otros", value: tailTotal, color: OTHERS_COLOR }];
  }

  const total = items.reduce((sum, d) => sum + d.value, 0);

  let cursor = 0;
  const slices = items.map((item) => {
    const pct = total > 0 ? (item.value / total) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return { ...item, pct, start, end: cursor };
  });

  const gradient = slices.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(", ");

  return (
    <div className="dash-donut">
      <div
        className="dash-donut-ring"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={`Total gastado ${formatCLP(total)}`}
      >
        <div className="dash-donut-hole">
          <span className="dash-donut-label">Total</span>
          <span className="dash-donut-total">{formatCLP(total)}</span>
        </div>
      </div>
      <ul className="dash-donut-legend">
        {slices.map((s) => (
          <li key={s.name} title={formatCLP(s.value)}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="dash-donut-name">{s.name}</span>
            <span className="dash-donut-pct">{Math.round(s.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
