import { apiClient } from "./client";

export interface UserSettings {
  payday: number | null;
  savings_target_pct: number;
  budget_alert_pct: number;
  default_account_id: number | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  payday: null,
  savings_target_pct: 20,
  budget_alert_pct: 80,
  default_account_id: null,
};

export async function getSettings(): Promise<UserSettings> {
  const { data } = await apiClient.get<UserSettings>("/settings");
  return data;
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await apiClient.patch<UserSettings>("/settings", patch);
  return data;
}

// Descarga el CSV con el token de la sesión (un <a href> simple no enviaría el header de autorización).
export async function downloadMovementsCsv(): Promise<void> {
  const response = await apiClient.get<Blob>("/export/movements.csv", { responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "finanzapp-movimientos.csv";
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
