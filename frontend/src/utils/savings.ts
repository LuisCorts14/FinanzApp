import type { SavingsGoal } from "../api/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fechas "YYYY-MM-DD" (o ISO con hora) a medianoche local, para comparar por día.
export function toLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatLongDate(value: string): string {
  return toLocalDate(value).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

export type RoutePlan =
  | { kind: "achieved" }
  | { kind: "expired"; remaining: number }
  | { kind: "plan"; remaining: number; daysLeft: number; daily: number; weekly: number; monthly: number };

// Cuánto hay que ahorrar desde hoy para llegar a la meta en la fecha objetivo.
export function computeRoute(goal: SavingsGoal): RoutePlan {
  const remaining = goal.target_amount - goal.current_amount;
  if (remaining <= 0) return { kind: "achieved" };

  const daysLeft = daysBetween(todayLocal(), toLocalDate(goal.target_date));
  if (daysLeft <= 0) return { kind: "expired", remaining };

  const daily = remaining / daysLeft;
  return { kind: "plan", remaining, daysLeft, daily, weekly: daily * 7, monthly: daily * 30 };
}

export type Pace =
  | { kind: "achieved" }
  | { kind: "expired" }
  | { kind: "on_track"; expected: number }
  | { kind: "ahead"; expected: number; diff: number }
  | { kind: "behind"; expected: number; diff: number };

// Plan lineal: desde lo que ya tenías al crear la meta hasta el monto objetivo en la fecha objetivo.
export function expectedAmountOn(goal: SavingsGoal, day: Date): number {
  const start = toLocalDate(goal.created_at);
  const end = toLocalDate(goal.target_date);
  const total = Math.max(1, daysBetween(start, end));
  const elapsed = Math.min(Math.max(daysBetween(start, day), 0), total);
  const base = Math.min(goal.start_amount, goal.target_amount);
  return base + ((goal.target_amount - base) * elapsed) / total;
}

// ¿Vas al ritmo del plan? Se compara lo ahorrado con lo que "deberías" llevar hoy.
export function computePace(goal: SavingsGoal): Pace {
  if (goal.current_amount >= goal.target_amount) return { kind: "achieved" };
  const today = todayLocal();
  if (daysBetween(today, toLocalDate(goal.target_date)) <= 0) return { kind: "expired" };

  const expected = expectedAmountOn(goal, today);
  const diff = goal.current_amount - expected;
  const tolerance = goal.target_amount * 0.02;
  if (Math.abs(diff) <= tolerance) return { kind: "on_track", expected };
  return diff > 0 ? { kind: "ahead", expected, diff } : { kind: "behind", expected, diff: -diff };
}
