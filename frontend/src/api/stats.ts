import { apiClient } from "./client";

export interface CategoryTotal {
  category_id: number;
  category_name: string;
  total: number;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
}

export interface BudgetStatus {
  category_id: number;
  category_name: string;
  monthly_budget: number;
  spent: number;
}

export async function getExpensesByCategory(month?: string): Promise<CategoryTotal[]> {
  const { data } = await apiClient.get<CategoryTotal[]>("/stats/expenses-by-category", {
    params: month ? { month } : undefined,
  });
  return data;
}

export async function getMonthlySummary(): Promise<MonthlySummary[]> {
  const { data } = await apiClient.get<MonthlySummary[]>("/stats/monthly-summary");
  return data;
}

export async function getBudgetStatus(month?: string): Promise<BudgetStatus[]> {
  const { data } = await apiClient.get<BudgetStatus[]>("/stats/budgets", {
    params: month ? { month } : undefined,
  });
  return data;
}

export interface WeeklySummary {
  week: number;
  start_day: number;
  end_day: number;
  income: number;
  expense: number;
}

export async function getWeeklySummary(month?: string): Promise<WeeklySummary[]> {
  const { data } = await apiClient.get<WeeklySummary[]>("/stats/weekly-summary", {
    params: month ? { month } : undefined,
  });
  return data;
}
