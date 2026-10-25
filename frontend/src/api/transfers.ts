import { apiClient } from "./client";
import type { Transfer, TransferCreate, TransferUpdate } from "./types";

export async function listTransfers(accountId?: number, month?: string): Promise<Transfer[]> {
  const params: Record<string, string | number> = {};
  if (accountId) params.account_id = accountId;
  if (month) params.month = month;
  const { data } = await apiClient.get<Transfer[]>("/transfers", {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function createTransfer(payload: TransferCreate): Promise<Transfer> {
  const { data } = await apiClient.post<Transfer>("/transfers", payload);
  return data;
}

export async function updateTransfer(id: number, payload: TransferUpdate): Promise<Transfer> {
  const { data } = await apiClient.patch<Transfer>(`/transfers/${id}`, payload);
  return data;
}

export async function deleteTransfer(id: number): Promise<void> {
  await apiClient.delete(`/transfers/${id}`);
}
