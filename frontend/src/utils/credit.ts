import type { Account } from "../api/types";

// Usar menos del 30% del cupo es la recomendación habitual para no sobreendeudarse.
export const HEALTHY_CREDIT_USE = 30;

export interface CreditUsage {
  limit: number;
  used: number;
  available: number;
  pct: number;
  status: "good" | "warning" | "critical";
  message: string;
}

// En una tarjeta, el saldo negativo es lo que se debe; eso es el cupo usado.
export function creditUsage(account: Account): CreditUsage | null {
  if (account.type !== "credit_card" || !account.credit_limit) return null;
  const limit = account.credit_limit;
  const used = Math.max(-account.balance, 0);
  const available = limit - used;
  const pct = (used / limit) * 100;

  if (pct > 100) {
    return {
      limit,
      used,
      available,
      pct,
      status: "critical",
      message: "Superaste tu cupo: evita usar esta tarjeta hasta pagar.",
    };
  }
  if (pct >= 80) {
    return {
      limit,
      used,
      available,
      pct,
      status: "warning",
      message: "Estás cerca del límite. Prioriza pagar esta deuda.",
    };
  }
  if (pct >= HEALTHY_CREDIT_USE) {
    return {
      limit,
      used,
      available,
      pct,
      status: "good",
      message: `Intenta usar menos del ${HEALTHY_CREDIT_USE}% de tu cupo.`,
    };
  }
  return { limit, used, available, pct, status: "good", message: "Buen uso: estás bajo el 30% de tu cupo." };
}
