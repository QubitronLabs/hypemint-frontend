/**
 * Alerts API Client
 */

import { apiClient } from "./client";

export type AlertCondition = "above" | "below" | "percent_change";
export type AlertStatus = "active" | "triggered" | "cancelled" | "expired";

export interface PriceAlert {
  id: string;
  userId: string;
  tokenId: string;
  condition: AlertCondition;
  targetPrice: string;
  note: string | null;
  status: AlertStatus;
  triggeredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  token?: {
    id: string;
    name: string;
    symbol: string;
    imageUrl: string | null;
    currentPrice: string;
  };
}

export interface CreateAlertInput {
  tokenId: string;
  condition: AlertCondition;
  targetPrice: string;
  note?: string;
  expiresAt?: string;
}

export interface AlertsResponse {
  success: boolean;
  data: {
    alerts: PriceAlert[];
  };
}

/**
 * Get user's alerts
 */
export async function getAlerts(status?: AlertStatus): Promise<PriceAlert[]> {
  const params = status ? { status } : {};
  const response = await apiClient.get<AlertsResponse>("/api/v1/alerts", {
    params,
  });
  return response.data.data.alerts;
}

/**
 * Create a new alert
 */
export async function createAlert(
  input: CreateAlertInput,
): Promise<PriceAlert> {
  const response = await apiClient.post<{
    success: boolean;
    data: { alert: PriceAlert };
  }>("/api/v1/alerts", input);
  return response.data.data.alert;
}

/**
 * Delete an alert
 */
export async function deleteAlert(alertId: string): Promise<void> {
  await apiClient.delete(`/api/v1/alerts/${alertId}`);
}
