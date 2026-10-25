import { apiClient } from "./client";
import type { AccountType } from "./types";

export interface InstitutionProduct {
  id: string;
  name: string;
  account_type: AccountType;
  currency: string;
}

export interface Institution {
  id: string;
  name: string;
  group: string;
  color: string;
  products: InstitutionProduct[];
}

export async function listInstitutions(): Promise<Institution[]> {
  const { data } = await apiClient.get<Institution[]>("/catalog/institutions");
  return data;
}
