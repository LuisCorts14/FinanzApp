// Estado de un presupuesto según el porcentaje gastado: ok < 80%, cuidado 80–99%, excedido >= 100%.
export function budgetStatusFor(pct: number): "good" | "warning" | "critical" {
  if (pct >= 100) return "critical";
  if (pct >= 80) return "warning";
  return "good";
}
