import { useEffect, useMemo, useRef, useState } from "react";
import type { SavingsContribution, SavingsGoal } from "../../api/types";
import { formatCLP } from "../../utils/format";
import { daysBetween, expectedAmountOn, toLocalDate, todayLocal } from "../../utils/savings";

const HEIGHT = 240;
const MARGIN = { top: 16, right: 20, bottom: 30, left: 64 };
const DAY_MS = 24 * 60 * 60 * 1000;

function compactCLP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)} mil`;
  return formatCLP(value);
}

function axisDate(d: Date): string {
  return d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }).replace(".", "");
}

function tooltipDate(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
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

interface SavingsProgressChartProps {
  goal: SavingsGoal;
  contributions: SavingsContribution[];
}

// Ahorro acumulado (escalones en cada abono) vs. el plan lineal hasta la fecha objetivo.
export default function SavingsProgressChart({ goal, contributions }: SavingsProgressChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>();
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const model = useMemo(() => {
    const goalStart = toLocalDate(goal.created_at);
    const end = toLocalDate(goal.target_date);
    const today = todayLocal();
    const firstContribution = contributions[0] ? toLocalDate(contributions[0].date) : goalStart;
    const start = firstContribution < goalStart ? firstContribution : goalStart;
    const lastActual = today < end ? today : end;

    // Puntos del acumulado: un escalón por fecha con abonos.
    const steps: { day: Date; total: number }[] = [];
    let running = 0;
    for (const c of contributions) {
      running += c.amount;
      const day = toLocalDate(c.date);
      const last = steps[steps.length - 1];
      if (last && last.day.getTime() === day.getTime()) last.total = running;
      else steps.push({ day, total: running });
    }

    const maxY = Math.max(goal.target_amount, ...steps.map((s) => s.total)) * 1.05;
    return { start, goalStart, end, today, lastActual, steps, maxY };
  }, [goal, contributions]);

  function amountOn(day: Date): number {
    let total = 0;
    for (const s of model.steps) {
      if (s.day <= day) total = s.total;
      else break;
    }
    return total;
  }

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const totalDays = Math.max(1, daysBetween(model.start, model.end));
  const x = (d: Date) => MARGIN.left + (daysBetween(model.start, d) / totalDays) * innerW;
  const y = (v: number) => MARGIN.top + innerH - (v / model.maxY) * innerH;

  // Línea escalonada del acumulado, desde el inicio hasta hoy (o la fecha objetivo).
  let actualPath = `M${x(model.start)},${y(0)}`;
  for (const s of model.steps) {
    actualPath += ` H${x(s.day)} V${y(s.total)}`;
  }
  actualPath += ` H${x(model.lastActual)}`;

  const yTicks = [0, goal.target_amount / 2, goal.target_amount];
  const showToday = model.today > model.start && model.today < model.end;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const day = new Date(model.start.getTime() + Math.round(ratio * totalDays) * DAY_MS);
    setHoverDay(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
  }

  const hover = hoverDay
    ? {
        x: x(hoverDay),
        planned: expectedAmountOn(goal, hoverDay),
        saved: hoverDay <= model.lastActual ? amountOn(hoverDay) : null,
      }
    : null;

  return (
    <div className="savings-chart">
      <div className="chart-legend savings-chart-legend">
        <span>
          <span className="legend-line legend-line-actual" /> Ahorrado
        </span>
        <span>
          <span className="legend-line legend-line-plan" /> Plan para llegar a tiempo
        </span>
      </div>
      <div ref={containerRef} className="savings-chart-canvas">
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Ahorro acumulado comparado con el plan">
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? "chart-baseline" : "chart-gridline"}
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(t)}
                  className="chart-axis-label"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {compactCLP(t)}
                </text>
              </g>
            ))}

            <text x={x(model.start)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="start">
              {axisDate(model.start)}
            </text>
            <text x={x(model.end)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="end">
              {axisDate(model.end)}
            </text>

            {showToday && (
              <g>
                <line
                  x1={x(model.today)}
                  x2={x(model.today)}
                  y1={MARGIN.top}
                  y2={MARGIN.top + innerH}
                  className="chart-today"
                />
                <text x={x(model.today)} y={HEIGHT - 8} className="chart-axis-label" textAnchor="middle">
                  Hoy
                </text>
              </g>
            )}

            <line
              x1={x(model.goalStart)}
              y1={y(Math.min(goal.start_amount, goal.target_amount))}
              x2={x(model.end)}
              y2={y(goal.target_amount)}
              className="chart-plan-line"
            />
            <path d={actualPath} className="chart-actual-line" />
            <circle cx={x(model.lastActual)} cy={y(amountOn(model.lastActual))} r={5} className="chart-actual-dot" />

            {hover && (
              <g pointerEvents="none">
                <line x1={hover.x} x2={hover.x} y1={MARGIN.top} y2={MARGIN.top + innerH} className="chart-crosshair" />
                {hover.saved !== null && <circle cx={hover.x} cy={y(hover.saved)} r={4} className="chart-actual-dot" />}
                <circle cx={hover.x} cy={y(hover.planned)} r={4} className="chart-plan-dot" />
              </g>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverDay(null)}
            />
          </svg>
        )}

        {hover && hoverDay && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(hover.x, 90), width - 90),
            }}
          >
            <span className="chart-tooltip-title">{tooltipDate(hoverDay)}</span>
            {hover.saved !== null && (
              <span className="chart-tooltip-row">
                <span className="legend-line legend-line-actual" />
                <strong>{formatCLP(hover.saved)}</strong> ahorrado
              </span>
            )}
            <span className="chart-tooltip-row">
              <span className="legend-line legend-line-plan" />
              <strong>{formatCLP(hover.planned)}</strong> según el plan
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
