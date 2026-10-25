import { useState } from "react";
import type { MonthlySummary } from "../../api/stats";
import { formatCLP } from "../../utils/format";
import { monthName, shortMonthLabel } from "../../utils/month";

const ARM_HEIGHT = 110;
const MAX_MONTHS = 12;

type Hovered = { month: string; income: number; expense: number } | null;

export default function MonthlyDivergingChart({ data }: { data: MonthlySummary[] }) {
  const [showTable, setShowTable] = useState(false);
  const [hovered, setHovered] = useState<Hovered>(null);

  if (data.length === 0) {
    return <p className="empty-state">Aún no hay movimientos registrados.</p>;
  }

  const months = data.slice(-MAX_MONTHS);
  const max = Math.max(...months.map((d) => Math.max(d.income, d.expense)), 1);

  return (
    <div>
      <div className="chart-toolbar">
        <div className="chart-legend">
          <span>
            <span className="legend-dot legend-dot-income" /> Ingresos (arriba)
          </span>
          <span>
            <span className="legend-dot legend-dot-expense" /> Gastos (abajo)
          </span>
        </div>
        <button type="button" className="button-secondary button-sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Ver gráfico" : "Ver como tabla"}
        </button>
      </div>

      {showTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="align-right">Ingresos</th>
                <th className="align-right">Gastos</th>
                <th className="align-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((d) => {
                const net = d.income - d.expense;
                return (
                  <tr key={d.month}>
                    <td className="cell-strong">{monthName(d.month, true)}</td>
                    <td className="align-right amount-income">{formatCLP(d.income)}</td>
                    <td className="align-right amount-expense">{formatCLP(d.expense)}</td>
                    <td className={`align-right ${net < 0 ? "amount-expense" : ""}`}>{formatCLP(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="diverging-chart">
            <div className="diverging-gridlines" style={{ height: ARM_HEIGHT * 2 }}>
              <div className="diverging-gridline" style={{ top: 0 }} />
              <div className="diverging-baseline" style={{ top: ARM_HEIGHT }} />
              <div className="diverging-gridline" style={{ top: ARM_HEIGHT * 2 }} />
            </div>

            <div className="diverging-columns">
              {months.map((d) => {
                const isHovered = hovered?.month === d.month;
                return (
                  <div
                    className={`diverging-column${isHovered ? " is-hovered" : ""}`}
                    key={d.month}
                    onMouseEnter={() => setHovered(d)}
                    onMouseLeave={() => setHovered(null)}
                    tabIndex={0}
                    onFocus={() => setHovered(d)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${monthName(d.month, true)}: ingresos ${formatCLP(d.income)}, gastos ${formatCLP(d.expense)}`}
                  >
                    <div className="diverging-arm diverging-arm-top" style={{ height: ARM_HEIGHT }}>
                      <div
                        className="diverging-bar diverging-bar-income"
                        style={{ height: (d.income / max) * ARM_HEIGHT }}
                      />
                    </div>
                    <div className="diverging-arm diverging-arm-bottom" style={{ height: ARM_HEIGHT }}>
                      <div
                        className="diverging-bar diverging-bar-expense"
                        style={{ height: (d.expense / max) * ARM_HEIGHT }}
                      />
                    </div>
                    <span className="diverging-label">{shortMonthLabel(d.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="diverging-readout">
            {hovered ? (
              <>
                <strong>{monthName(hovered.month, true)}:</strong> ingresos <strong>{formatCLP(hovered.income)}</strong>{" "}
                · gastos <strong>{formatCLP(hovered.expense)}</strong> · diferencia{" "}
                <strong>{formatCLP(hovered.income - hovered.expense)}</strong>
              </>
            ) : (
              "Pasa el mouse sobre un mes para ver el detalle."
            )}
          </p>
        </>
      )}
    </div>
  );
}
