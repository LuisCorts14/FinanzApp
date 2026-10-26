import { useEffect, useRef, useState } from "react";
import type { PlanScenario } from "../../api/types";
import { monthsFromNow } from "../../utils/debts";
import { formatCLP } from "../../utils/format";

const HEIGHT = 240;
const MARGIN = { top: 16, right: 20, bottom: 30, left: 64 };
const MAX_HORIZON = 120; // 10 años: más allá, la línea de "solo mínimos" se corta

function compactCLP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)} mil`;
  return formatCLP(value);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface DebtPlanChartProps {
  plan: PlanScenario;
  minimumOnly: PlanScenario;
}

// Deuda total mes a mes: con el plan elegido vs. pagando solo los mínimos.
export default function DebtPlanChart({ plan, minimumOnly }: DebtPlanChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>();
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const planMonths = plan.months ?? 0;
  const minMonths = minimumOnly.months ?? MAX_HORIZON;
  const horizon = Math.max(planMonths, Math.min(minMonths, MAX_HORIZON), 1);
  const valueAt = (s: PlanScenario, m: number) => s.timeline[Math.min(m, s.timeline.length - 1)] ?? 0;
  const maxY = Math.max(...plan.timeline, ...minimumOnly.timeline.slice(0, horizon + 1), 1) * 1.05;

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (m: number) => MARGIN.left + (m / horizon) * innerW;
  const y = (v: number) => MARGIN.top + innerH - (v / maxY) * innerH;

  const path = (s: PlanScenario, until: number) =>
    Array.from({ length: until + 1 }, (_, m) => `${m === 0 ? "M" : "L"}${x(m)},${y(valueAt(s, m))}`).join(" ");
  const planPath = path(plan, horizon);
  const minPath = path(minimumOnly, horizon);
  const top = plan.timeline[0] ?? 0;
  const yTicks = [0, top / 2, top];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverMonth(Math.round(ratio * horizon));
  }

  return (
    <div className="savings-chart">
      <div className="chart-legend savings-chart-legend">
        <span>
          <span className="legend-line" /> Con tu plan
        </span>
        <span>
          <span className="legend-line legend-line-minimum" /> Pagando solo el mínimo
        </span>
      </div>
      <div ref={containerRef} className="savings-chart-canvas">
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Deuda total mes a mes con el plan y pagando solo el mínimo">
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? "chart-baseline" : "chart-gridline"}
                />
                <text x={MARGIN.left - 8} y={y(t)} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
                  {compactCLP(t)}
                </text>
              </g>
            ))}
            <text x={x(0)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="start">
              Hoy
            </text>
            <text x={x(horizon)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="end">
              {monthsFromNow(horizon)}
            </text>
            {planMonths > 0 && planMonths < horizon && (
              <text x={x(planMonths)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="middle">
                {monthsFromNow(planMonths)}
              </text>
            )}

            <path d={minPath} className="chart-minimum-line" />
            <path d={planPath} className="chart-actual-line" />
            {planMonths > 0 && <circle cx={x(planMonths)} cy={y(0)} r={5} className="chart-actual-dot" />}

            {hoverMonth !== null && (
              <g pointerEvents="none">
                <line
                  x1={x(hoverMonth)}
                  x2={x(hoverMonth)}
                  y1={MARGIN.top}
                  y2={MARGIN.top + innerH}
                  className="chart-crosshair"
                />
                <circle cx={x(hoverMonth)} cy={y(valueAt(minimumOnly, hoverMonth))} r={4} className="chart-minimum-dot" />
                <circle cx={x(hoverMonth)} cy={y(valueAt(plan, hoverMonth))} r={4} className="chart-actual-dot" />
              </g>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverMonth(null)}
            />
          </svg>
        )}

        {hoverMonth !== null && (
          <div className="chart-tooltip" style={{ left: Math.min(Math.max(x(hoverMonth), 90), width - 90) }}>
            <span className="chart-tooltip-title">{hoverMonth === 0 ? "Hoy" : monthsFromNow(hoverMonth)}</span>
            <span className="chart-tooltip-row">
              <span className="legend-line" />
              <strong>{formatCLP(valueAt(plan, hoverMonth))}</strong> con tu plan
            </span>
            <span className="chart-tooltip-row">
              <span className="legend-line legend-line-minimum" />
              <strong>{formatCLP(valueAt(minimumOnly, hoverMonth))}</strong> solo mínimos
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
