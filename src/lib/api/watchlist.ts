/**
 * Watchlist API Client
 */

import { apiClient } from "./client";

export interface WatchlistItem {
  id: string;
  userId: string;
  tokenId: string;
  createdAt: string;
  token: {
    id: string;
    name: string;
    symbol: string;
    imageUrl: string | null;
    currentPrice: string;
    marketCap: string;
    volume24h: string;
    status: string;
  };
}

export interface WatchlistResponse {
  success: boolean;
  data: {
    items: WatchlistItem[];
  };
}

/**
 * Get user's watchlist
 */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  const response = await apiClient.get<WatchlistResponse>("/api/v1/watchlist");
  return response.data.data.items;
}

/**
 * Add token to watchlist
 */
export async function addToWatchlist(tokenId: string): Promise<WatchlistItem> {
  const response = await apiClient.post<{
    success: boolean;
    data: { item: WatchlistItem };
  }>(`/api/v1/watchlist/${tokenId}`);
  return response.data.data.item;
}

/**
 * Remove token from watchlist
 */
export async function removeFromWatchlist(tokenId: string): Promise<void> {
  await apiClient.delete(`/api/v1/watchlist/${tokenId}`);
}

/**
 * Check if token is in watchlist
 */
export async function isInWatchlist(tokenId: string): Promise<boolean> {
  const response = await apiClient.get<{
    success: boolean;
    data: { isInWatchlist: boolean };
  }>(`/api/v1/watchlist/${tokenId}/check`);
  return response.data.data.isInWatchlist;
}
