import { apiClient } from "./client";
import type { Account, AccountCreate } from "./types";

export async function listAccounts(): Promise<Account[]> {
  const { data } = await apiClient.get<Account[]>("/accounts");
  return data;
}

export async function getAccount(id: number): Promise<Account> {
  const { data } = await apiClient.get<Account>(`/accounts/${id}`);
  return data;
}

export async function createAccount(payload: AccountCreate): Promise<Account> {
  const { data } = await apiClient.post<Account>("/accounts", payload);
  return data;
}

export async function deleteAccount(id: number): Promise<void> {
  await apiClient.delete(`/accounts/${id}`);
}
