/**
 * Leaderboard API Client
 */

import { apiClient } from "./client";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all_time";
export type LeaderboardMetric = "pnl" | "volume" | "trades" | "win_rate";

export interface LeaderboardBadge {
  type: string;
  label: string;
  earnedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  walletAddress: string;
  avatarUrl: string | null;
  totalPnl: string;
  totalPnlPercent: number;
  totalVolume: string;
  tradeCount: number;
  winRate: number;
  bestTrade: string;
  badges: LeaderboardBadge[];
}

export interface UserRanking {
  userId: string;
  rank: number;
  totalEntries: number;
  percentile: number;
  entry: LeaderboardEntry;
}

export interface LeaderboardStats {
  totalTraders: number;
  totalVolume: string;
  totalTrades: number;
  avgWinRate: number;
}

export interface LeaderboardParams {
  period?: LeaderboardPeriod;
  metric?: LeaderboardMetric;
  limit?: number;
  offset?: number;
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  params?: LeaderboardParams,
): Promise<LeaderboardEntry[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: { entries: LeaderboardEntry[] };
  }>("/api/v1/leaderboard", { params });
  return response.data.data.entries;
}

/**
 * Get leaderboard stats
 */
export async function getLeaderboardStats(
  period?: LeaderboardPeriod,
): Promise<LeaderboardStats> {
  const response = await apiClient.get<{
    success: boolean;
    data: LeaderboardStats;
  }>("/api/v1/leaderboard/stats", { params: period ? { period } : {} });
  return response.data.data;
}

/**
 * Get current user's ranking
 */
export async function getMyRanking(
  period?: LeaderboardPeriod,
): Promise<UserRanking | null> {
  const response = await apiClient.get<{
    success: boolean;
    data: UserRanking | null;
  }>("/api/v1/leaderboard/me", { params: period ? { period } : {} });
  return response.data.data;
}
