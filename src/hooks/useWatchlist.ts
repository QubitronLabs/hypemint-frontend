"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  type WatchlistItem,
} from "@/lib/api/watchlist";

// Query keys
export const watchlistKeys = {
  all: ["watchlist"] as const,
  list: () => [...watchlistKeys.all, "list"] as const,
  check: (tokenId: string) => [...watchlistKeys.all, "check", tokenId] as const,
};

/**
 * Hook to fetch user's watchlist
 */
export function useWatchlist() {
  return useQuery({
    queryKey: watchlistKeys.list(),
    queryFn: getWatchlist,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to check if a token is in watchlist
 */
export function useIsInWatchlist(tokenId: string) {
  return useQuery({
    queryKey: watchlistKeys.check(tokenId),
    queryFn: () => isInWatchlist(tokenId),
    enabled: !!tokenId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to toggle watchlist (add/remove)
 */
export function useToggleWatchlist() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: addToWatchlist,
    onSuccess: (_, tokenId) => {
      queryClient.invalidateQueries({ queryKey: watchlistKeys.all });
      queryClient.setQueryData(watchlistKeys.check(tokenId), true);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: (_, tokenId) => {
      queryClient.invalidateQueries({ queryKey: watchlistKeys.all });
      queryClient.setQueryData(watchlistKeys.check(tokenId), false);
    },
  });

  return {
    add: addMutation,
    remove: removeMutation,
    toggle: async (tokenId: string, isCurrentlyInWatchlist: boolean) => {
      if (isCurrentlyInWatchlist) {
        await removeMutation.mutateAsync(tokenId);
      } else {
        await addMutation.mutateAsync(tokenId);
      }
    },
    isLoading: addMutation.isPending || removeMutation.isPending,
  };
}
