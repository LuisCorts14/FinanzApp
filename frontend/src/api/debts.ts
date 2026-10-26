import { apiClient } from "./client";
import type { Debt, DebtCreate, DebtPlan, DebtStrategy, DebtUpdate } from "./types";

export async function listDebts(): Promise<Debt[]> {
  const { data } = await apiClient.get<Debt[]>("/debts");
  return data;
}

export async function createDebt(payload: DebtCreate): Promise<Debt> {
  const { data } = await apiClient.post<Debt>("/debts", payload);
  return data;
}

export async function updateDebt(id: number, payload: DebtUpdate): Promise<Debt> {
  const { data } = await apiClient.patch<Debt>(`/debts/${id}`, payload);
  return data;
}

export async function deleteDebt(id: number): Promise<void> {
  await apiClient.delete(`/debts/${id}`);
}

export async function registerDebtPayment(id: number, amount: number): Promise<Debt> {
  const { data } = await apiClient.post<Debt>(`/debts/${id}/payments`, { amount });
  return data;
}

// Sin `budget` usa el monto guardado (o, si no hay, la suma de los pagos mínimos).
export async function getDebtPlan(budget?: number): Promise<DebtPlan> {
  const { data } = await apiClient.get<DebtPlan>("/debts/plan", { params: budget ? { budget } : undefined });
  return data;
}

export async function saveDebtPlanSettings(monthly_budget: number | null, strategy: DebtStrategy): Promise<void> {
  await apiClient.put("/debts/plan-settings", { monthly_budget, strategy });
}
