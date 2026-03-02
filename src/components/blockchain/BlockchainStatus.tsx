"use client";

/**
 * BlockchainStatus Component
 *
 * Displays real-time blockchain connection status and sync information.
 * Supports both EVM and Solana chain types.
 */

import { motion } from "framer-motion";
import { useBlockNumber, useChainId } from "wagmi";
import { Activity, Wifi, WifiOff, Database, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useActiveChainType, useChainId as useAppChainId } from "@/lib/network";
import { getChainDisplayName } from "@/lib/wagmi/config";

interface BlockchainStatusProps {
  className?: string;
  compact?: boolean;
}

/**
 * Small badge showing whether the user is on EVM or Solana
 */
function ChainTypeBadge({ chainType }: { chainType: "EVM" | "SOLANA" }) {
  const isSolana = chainType === "SOLANA";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        isSolana
          ? "bg-purple-500/15 text-purple-400"
          : "bg-blue-500/15 text-blue-400",
      )}
    >
      {isSolana ? (
        <Globe className="h-2.5 w-2.5" />
      ) : (
        <Zap className="h-2.5 w-2.5" />
      )}
      {isSolana ? "SOL" : "EVM"}
    </span>
  );
}

export function BlockchainStatus({
  className,
  compact = false,
}: BlockchainStatusProps) {
  const chainId = useChainId();
  const activeChainType = useActiveChainType();
  const appChainId = useAppChainId();
  const { data: blockNumber, isLoading: blockLoading } = useBlockNumber({
    watch: true,
    query: {
      refetchInterval: 5000, // Update every 5 seconds
    },
  });
  const { isConnected: wsConnected } = useWebSocket({});

  const isSolana = activeChainType === "SOLANA";
  const chainName = isSolana
    ? getChainDisplayName(appChainId ?? 901)
    : getChainDisplayName(chainId);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <ChainTypeBadge chainType={activeChainType} />
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full",
            blockNumber || isSolana ? "bg-green-500" : "bg-yellow-500",
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-xs text-muted-foreground">
          {isSolana
            ? "Solana"
            : blockNumber
              ? `#${blockNumber.toLocaleString()}`
              : "Connecting..."}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-3 space-y-2",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Blockchain Status
        </span>
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full",
            blockNumber ? "bg-green-500" : "bg-yellow-500",
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Chain */}
        <div className="flex items-center gap-2">
          <ChainTypeBadge chainType={activeChainType} />
          <span className="text-xs">{chainName}</span>
        </div>

        {/* Block Number */}
        <div className="flex items-center gap-2">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs tabular-nums">
            {blockLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : blockNumber ? (
              `#${blockNumber.toLocaleString()}`
            ) : (
              "—"
            )}
          </span>
        </div>

        {/* WebSocket */}
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </>
          )}
        </div>

        {/* Activity */}
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Synced</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact blockchain indicator for headers
 */
export function BlockchainIndicator({ className }: { className?: string }) {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { refetchInterval: 10000 },
  });
  const { isConnected: wsConnected } = useWebSocket({});

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Live dot */}
      <motion.div
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          wsConnected && blockNumber ? "bg-green-500" : "bg-yellow-500",
        )}
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {blockNumber ? blockNumber.toLocaleString() : "..."}
      </span>
    </div>
  );
}
