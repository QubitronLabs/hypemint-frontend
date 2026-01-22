"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getLeaderboard,
  getLeaderboardStats,
  getMyRanking,
  type LeaderboardParams,
  type LeaderboardPeriod,
} from "@/lib/api/leaderboard";

// Query keys
export const leaderboardKeys = {
  all: ["leaderboard"] as const,
  lists: () => [...leaderboardKeys.all, "list"] as const,
  list: (params?: LeaderboardParams) =>
    [...leaderboardKeys.lists(), params] as const,
  stats: (period?: LeaderboardPeriod) =>
    [...leaderboardKeys.all, "stats", period] as const,
  myRanking: (period?: LeaderboardPeriod) =>
    [...leaderboardKeys.all, "me", period] as const,
};

/**
 * Hook to fetch leaderboard
 */
export function useLeaderboard(params?: LeaderboardParams) {
  return useQuery({
    queryKey: leaderboardKeys.list(params),
    queryFn: () => getLeaderboard(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch leaderboard stats
 */
export function useLeaderboardStats(period?: LeaderboardPeriod) {
  return useQuery({
    queryKey: leaderboardKeys.stats(period),
    queryFn: () => getLeaderboardStats(period),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch current user's ranking
 */
export function useMyRanking(period?: LeaderboardPeriod) {
  return useQuery({
    queryKey: leaderboardKeys.myRanking(period),
    queryFn: () => getMyRanking(period),
    staleTime: 60 * 1000,
  });
}
