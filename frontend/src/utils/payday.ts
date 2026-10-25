import { daysBetween, todayLocal } from "./savings";

// Próxima fecha de sueldo: el día elegido de este mes si aún no llega, si no el del mes siguiente.
// En meses más cortos (p. ej. día 31 en febrero) se usa el último día del mes.
export function nextPayday(payday: number, from: Date = todayLocal()): Date {
  const inMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(payday, lastDay));
  };
  const thisMonth = inMonth(from.getFullYear(), from.getMonth());
  return thisMonth > from ? thisMonth : inMonth(from.getFullYear(), from.getMonth() + 1);
}

export function daysUntilPayday(payday: number, from: Date = todayLocal()): number {
  return daysBetween(from, nextPayday(payday, from));
}
