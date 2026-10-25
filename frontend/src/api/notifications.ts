import { apiClient } from "./client";

export type NotificationSeverity = "critical" | "warning" | "info" | "good";

export interface AppNotification {
  key: string;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string;
  read: boolean;
}

export interface NotificationList {
  items: AppNotification[];
  unread_count: number;
}

export async function listNotifications(): Promise<NotificationList> {
  const { data } = await apiClient.get<NotificationList>("/notifications");
  return data;
}

// Sin keys marca todas las notificaciones actuales como leídas.
export async function markNotificationsRead(keys?: string[]): Promise<void> {
  await apiClient.post("/notifications/read", keys ? { keys } : {});
}
