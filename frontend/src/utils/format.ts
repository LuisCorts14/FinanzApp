// Montos en pesos chilenos: sin decimales y con punto como separador de miles ($1.450.000).
export function formatCLP(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("es-CL")}`;
}

// "2026-10-22" -> "22 oct"
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const monthShort = new Date(y, m - 1, d).toLocaleDateString("es-CL", { month: "short" }).replace(".", "");
  return `${String(d).padStart(2, "0")} ${monthShort}`;
}

// Variación porcentual vs. un valor anterior; null si no hay base para comparar.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Monto en la moneda de la cuenta: CLP sin decimales, otras monedas con 2 decimales.
export function formatMoney(value: number, currency: string): string {
  if (currency === "CLP") return formatCLP(value);
  return value.toLocaleString("es-CL", { style: "currency", currency, minimumFractionDigits: 2 });
}
