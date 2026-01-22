/**
 * Orders API Client
 */

import { apiClient } from "./client";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "stop_limit";
export type OrderStatus =
  | "open"
  | "partial"
  | "filled"
  | "cancelled"
  | "expired";
export type TimeInForce = "gtc" | "ioc" | "fok" | "day";

export interface LimitOrder {
  id: string;
  userId: string;
  tokenId: string;
  side: OrderSide;
  orderType: OrderType;
  price: string;
  amount: string;
  filledAmount: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  token?: {
    id: string;
    name: string;
    symbol: string;
    imageUrl: string | null;
  };
}

export interface OrderBookLevel {
  price: string;
  amount: string;
  orderCount: number;
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: string;
  lastPrice: string;
}

export interface CreateOrderInput {
  tokenId: string;
  side: OrderSide;
  orderType: OrderType;
  price: string;
  amount: string;
  timeInForce?: TimeInForce;
  expiresAt?: string;
}

/**
 * Get user's orders
 */
export async function getOrders(status?: OrderStatus): Promise<LimitOrder[]> {
  const params = status ? { status } : {};
  const response = await apiClient.get<{
    success: boolean;
    data: { orders: LimitOrder[] };
  }>("/api/v1/orders", { params });
  return response.data.data.orders;
}

/**
 * Create a new limit order
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<LimitOrder> {
  const response = await apiClient.post<{
    success: boolean;
    data: { order: LimitOrder };
  }>("/api/v1/orders", input);
  return response.data.data.order;
}

/**
 * Get order book for a token
 */
export async function getOrderBook(
  tokenId: string,
  depth?: number,
): Promise<OrderBook> {
  const params = depth ? { depth: depth.toString() } : {};
  const response = await apiClient.get<{ success: boolean; data: OrderBook }>(
    `/api/v1/orders/book/${tokenId}`,
    { params },
  );
  return response.data.data;
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.delete(`/api/v1/orders/${orderId}`);
}
