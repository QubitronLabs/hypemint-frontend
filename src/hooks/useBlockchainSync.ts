"use client";

/**
 * useBlockchainSync Hook
 *
 * Provides real-time blockchain synchronization capabilities.
 * Handles syncing token state, holders, and balances with on-chain data.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBlockNumber } from "wagmi";
import { tokenKeys, useSyncToken, useWalletTokenBalance } from "./useTokens";
import { useWebSocket } from "./useWebSocket";
import { toast } from "sonner";

interface BlockchainSyncOptions {
  /** Token ID to sync */
  tokenId: string;
  /** Token contract address (optional, for on-chain balance) */
  tokenAddress?: string;
  /** Auto-sync on new blocks */
  autoSyncOnBlock?: boolean;
  /** Sync interval in milliseconds (default: 60000 - 1 minute) */
  syncInterval?: number;
  /** Enable WebSocket updates */
  enableWebSocket?: boolean;
}

interface BlockchainSyncState {
  /** Last sync timestamp */
  lastSynced: Date | null;
  /** Whether currently syncing */
  isSyncing: boolean;
  /** Sync error message */
  error: string | null;
  /** Number of syncs performed */
  syncCount: number;
}

export function useBlockchainSync(options: BlockchainSyncOptions) {
  const {
    tokenId,
    tokenAddress,
    autoSyncOnBlock = false,
    syncInterval = 60000,
    enableWebSocket = true,
  } = options;

  const [state, setState] = useState<BlockchainSyncState>({
    lastSynced: null,
    isSyncing: false,
    error: null,
    syncCount: 0,
  });

  const queryClient = useQueryClient();
  const { address } = useAccount();
  const syncMutation = useSyncToken();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Block number for auto-sync
  const { data: blockNumber } = useBlockNumber({
    watch: autoSyncOnBlock,
    query: {
      enabled: autoSyncOnBlock,
    },
  });

  // On-chain balance query
  const { data: onChainBalance, refetch: refetchBalance } =
    useWalletTokenBalance(tokenId, address);

  // Sync function
  const sync = useCallback(
    async (showToast = false) => {
      if (state.isSyncing || !tokenId) return;

      setState((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        const result = await syncMutation.mutateAsync(tokenId);

        if (result.synced) {
          setState((prev) => ({
            ...prev,
            lastSynced: new Date(),
            syncCount: prev.syncCount + 1,
            isSyncing: false,
          }));

          // Invalidate related queries
          queryClient.invalidateQueries({
            queryKey: tokenKeys.detail(tokenId),
          });
          queryClient.invalidateQueries({
            queryKey: tokenKeys.holders(tokenId),
          });

          if (showToast) {
            toast.success("Synced with blockchain", {
              description: `Holders: ${result.holdersCount ?? 0}`,
            });
          }
        } else {
          throw new Error(result.message || "Sync failed");
        }
      } catch (error: any) {
        const errorMessage = error.message || "Failed to sync";
        setState((prev) => ({
          ...prev,
          isSyncing: false,
          error: errorMessage,
        }));

        if (showToast) {
          toast.error("Sync failed", { description: errorMessage });
        }
      }
    },
    [tokenId, state.isSyncing, syncMutation, queryClient],
  );

  // WebSocket handler for real-time updates
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (
        message.channel === `trades:${tokenId}` &&
        message.event === "trade_executed"
      ) {
        // A trade happened - sync to get latest state
        sync();
      }
      if (
        message.channel === `price:${tokenId}` &&
        message.event === "price_update"
      ) {
        // Price updated - invalidate queries
        queryClient.invalidateQueries({ queryKey: tokenKeys.detail(tokenId) });
      }
    },
    [tokenId, sync, queryClient],
  );

  const {
    subscribe,
    unsubscribe,
    isConnected: wsConnected,
  } = useWebSocket({
    onMessage: handleWebSocketMessage,
  });

  // Subscribe to WebSocket channels
  useEffect(() => {
    if (enableWebSocket && wsConnected && tokenId) {
      subscribe(`trades:${tokenId}`);
      subscribe(`price:${tokenId}`);

      return () => {
        unsubscribe(`trades:${tokenId}`);
        unsubscribe(`price:${tokenId}`);
      };
    }
  }, [enableWebSocket, wsConnected, tokenId, subscribe, unsubscribe]);

  // Auto-sync on new blocks
  useEffect(() => {
    if (autoSyncOnBlock && blockNumber) {
      // Sync every N blocks (e.g., every 10 blocks to reduce RPC calls)
      if (Number(blockNumber) % 10 === 0) {
        sync();
      }
    }
  }, [autoSyncOnBlock, blockNumber, sync]);

  // Interval-based sync
  useEffect(() => {
    if (syncInterval > 0) {
      intervalRef.current = setInterval(() => {
        sync();
      }, syncInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [syncInterval, sync]);

  // Initial sync on mount
  useEffect(() => {
    if (tokenId) {
      sync();
    }
  }, [tokenId]); // Only on tokenId change

  return {
    ...state,
    sync: () => sync(true),
    onChainBalance: onChainBalance?.balanceFormatted ?? 0,
    refetchBalance,
    wsConnected,
  };
}

/**
 * Simple hook for manual blockchain sync
 */
export function useManualSync(tokenId: string) {
  const syncMutation = useSyncToken();
  const queryClient = useQueryClient();

  const sync = useCallback(async () => {
    try {
      const result = await syncMutation.mutateAsync(tokenId);

      if (result.synced) {
        // Invalidate all related queries
        queryClient.invalidateQueries({ queryKey: tokenKeys.detail(tokenId) });
        queryClient.invalidateQueries({ queryKey: tokenKeys.holders(tokenId) });

        toast.success("Synced with blockchain", {
          description: `Market cap: ${result.marketCap ? `$${(parseFloat(result.marketCap) / 1e18).toLocaleString()}` : "N/A"}`,
        });

        return result;
      } else {
        throw new Error(result.message || "Sync failed");
      }
    } catch (error: any) {
      toast.error("Sync failed", {
        description: error.message || "Could not sync with blockchain",
      });
      throw error;
    }
  }, [tokenId, syncMutation, queryClient]);

  return {
    sync,
    isSyncing: syncMutation.isPending,
  };
}
