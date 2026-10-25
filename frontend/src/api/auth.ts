import { apiClient } from "./client";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function register(email: string, password: string, fullName?: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/register", {
    email,
    password,
    full_name: fullName || null,
  });
  return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, new_password: newPassword });
}

export interface UserSummary {
  accounts: number;
  transactions: number;
  transfers: number;
  categories: number;
  savings_goals: number;
}

export async function updateMe(payload: {
  full_name?: string | null;
  email?: string;
  current_password?: string;
}): Promise<User> {
  const { data } = await apiClient.patch<User>("/auth/me", payload);
  return data;
}

// Devuelve un token nuevo: el anterior (y el de otros dispositivos) deja de servir.
export async function changePassword(currentPassword: string, newPassword: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

export async function getMySummary(): Promise<UserSummary> {
  const { data } = await apiClient.get<UserSummary>("/auth/me/summary");
  return data;
}

export async function deleteMyAccount(password: string): Promise<void> {
  await apiClient.post("/auth/delete-account", { password });
}
