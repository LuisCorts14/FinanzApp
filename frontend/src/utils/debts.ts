import type { DebtKind, PlanDebt } from "../api/types";

export const DEBT_KIND_LABELS: Record<DebtKind | "credit_card", string> = {
  credit_card: "Tarjeta de crédito",
  consumer_loan: "Crédito de consumo",
  cash_advance: "Avance en efectivo",
  store_credit: "Casa comercial",
  personal: "Préstamo personal",
  other: "Otra deuda",
};

export const DEBT_KINDS: DebtKind[] = ["consumer_loan", "cash_advance", "store_credit", "personal", "other"];

// "dentro de N meses" -> "mar 2027"
export function monthsFromNow(months: number): string {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  return d.toLocaleDateString("es-CL", { month: "short", year: "numeric" }).replace(".", "");
}

// 14 -> "1 año y 2 meses"
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? "1 año" : `${years} años`;
  const m = rest === 1 ? "1 mes" : `${rest} meses`;
  if (years === 0) return m;
  if (rest === 0) return y;
  return `${y} y ${m}`;
}

// La tasa se muestra con coma decimal, como en los estados de cuenta: 2,35%.
export function formatRate(rate: number): string {
  return `${rate.toLocaleString("es-CL", { maximumFractionDigits: 3 })}%`;
}

// Un pago mínimo que no cubre los intereses del mes hace que la deuda crezca en vez de bajar.
export function minimumBelowInterest(debt: PlanDebt): boolean {
  return debt.included && (debt.minimum_payment ?? 0) <= debt.monthly_interest;
}
