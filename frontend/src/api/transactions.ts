import { apiClient } from "./client";
import type { Transaction, TransactionCreate, TransactionUpdate } from "./types";

export async function listTransactions(accountId?: number, month?: string): Promise<Transaction[]> {
  const params: Record<string, string | number> = {};
  if (accountId) params.account_id = accountId;
  if (month) params.month = month;
  const { data } = await apiClient.get<Transaction[]>("/transactions", {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function createTransaction(payload: TransactionCreate): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>("/transactions", payload);
  return data;
}

export async function updateTransaction(id: number, payload: TransactionUpdate): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}`, payload);
  return data;
}

export async function deleteTransaction(id: number): Promise<void> {
  await apiClient.delete(`/transactions/${id}`);
}
