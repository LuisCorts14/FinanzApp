import { apiClient } from "./client";

export interface ReceiptQuota {
  enabled: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export interface ReceiptItem {
  description: string;
  amount: number;
  category_id: number | null;
}

export interface ReceiptGroup {
  category_id: number | null;
  amount: number;
  item_count: number;
}

export interface ReceiptScanResult {
  merchant: string | null;
  date: string | null;
  currency: string;
  total: number | null;
  items: ReceiptItem[];
  groups: ReceiptGroup[];
  items_total: number;
  quota: ReceiptQuota;
}

export async function getReceiptQuota(): Promise<ReceiptQuota> {
  const { data } = await apiClient.get<ReceiptQuota>("/receipts/quota");
  return data;
}

export async function scanReceipt(image: Blob): Promise<ReceiptScanResult> {
  const form = new FormData();
  form.append("image", image, "boleta.jpg");
  // Leer una boleta puede tardar varios segundos.
  const { data } = await apiClient.post<ReceiptScanResult>("/receipts/scan", form, { timeout: 120_000 });
  return data;
}
