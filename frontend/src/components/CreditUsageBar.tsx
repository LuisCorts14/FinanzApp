import type { CreditUsage } from "../utils/credit";
import { formatCLP } from "../utils/format";

const STATUS_ICON = { good: "✓", warning: "!", critical: "!" } as const;

// Cupo usado vs. disponible de una tarjeta de crédito, con un consejo según el porcentaje.
export default function CreditUsageBar({ usage, compact = false }: { usage: CreditUsage; compact?: boolean }) {
  return (
    <div className={`credit-usage${compact ? " credit-usage-compact" : ""}`}>
      <div className="credit-usage-header">
        {compact ? (
          <>
            <span>
              <strong>{Math.round(usage.pct)}%</strong> usado
            </span>
            <span>
              <strong>{formatCLP(Math.abs(usage.available))}</strong> {usage.available >= 0 ? "disponible" : "excedido"}
            </span>
          </>
        ) : (
          <>
            <span>
              Cupo usado <strong>{Math.round(usage.pct)}%</strong>
            </span>
            <span>
              {usage.available >= 0 ? "Disponible" : "Excedido"} <strong>{formatCLP(Math.abs(usage.available))}</strong>
            </span>
          </>
        )}
      </div>
      <div className="budget-track" aria-hidden="true">
        <div className={`budget-fill budget-fill-${usage.status}`} style={{ width: `${Math.min(usage.pct, 100)}%` }} />
      </div>
      <span className={`budget-row-note budget-note-${usage.status}`}>
        <span aria-hidden="true">{STATUS_ICON[usage.status]} </span>
        {compact ? `${formatCLP(usage.used)} de ${formatCLP(usage.limit)}` : usage.message}
      </span>
    </div>
  );
}
