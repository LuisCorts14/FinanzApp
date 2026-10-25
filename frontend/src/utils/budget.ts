// Estado de un presupuesto según el porcentaje gastado: ok bajo el umbral de aviso, cuidado desde el umbral,
// excedido desde el 100%. El umbral se elige en Configuración (80% por defecto).
export function budgetStatusFor(pct: number, alertPct = 80): "good" | "warning" | "critical" {
  if (pct >= 100) return "critical";
  if (pct >= alertPct) return "warning";
  return "good";
}
