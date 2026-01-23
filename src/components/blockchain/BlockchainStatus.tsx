"use client";

/**
 * BlockchainStatus Component
 *
 * Displays real-time blockchain connection status and sync information.
 */

import { motion } from "framer-motion";
import { useBlockNumber, useChainId } from "wagmi";
import { Activity, Wifi, WifiOff, Database, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";

interface BlockchainStatusProps {
  className?: string;
  compact?: boolean;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  80002: "Polygon Amoy",
  8453: "Base",
};

export function BlockchainStatus({
  className,
  compact = false,
}: BlockchainStatusProps) {
  const chainId = useChainId();
  const { data: blockNumber, isLoading: blockLoading } = useBlockNumber({
    watch: true,
    query: {
      refetchInterval: 5000, // Update every 5 seconds
    },
  });
  const { isConnected: wsConnected } = useWebSocket({});

  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full",
            blockNumber ? "bg-green-500" : "bg-yellow-500",
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-xs text-muted-foreground">
          {blockNumber ? `#${blockNumber.toLocaleString()}` : "Connecting..."}
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
          <Zap className="h-3 w-3 text-primary" />
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
