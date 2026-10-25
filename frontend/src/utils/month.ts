export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "2026-10" -> "octubre" (o "Octubre 2026" con año).
export function monthName(month: string, withYear = false): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  if (!withYear) return date.toLocaleDateString("es-CL", { month: "long" });
  const label = date.toLocaleDateString("es-CL", { month: "long", year: "numeric" }).replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "2026-10" -> "oct 26", para ejes de gráficos.
export function shortMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CL", { month: "short", year: "2-digit" }).replace(".", "");
}
