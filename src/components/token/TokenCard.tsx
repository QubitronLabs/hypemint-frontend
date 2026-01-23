"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Users, Activity } from "lucide-react";
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import type { Token } from "@/types";

interface TokenCardProps {
  token: Token;
  className?: string;
}

/**
 * TokenCard - Clean, minimal token display
 */
export function TokenCard({ token, className }: TokenCardProps) {
  // Add null safety for priceChange24h
  const priceChange = token.priceChange24h ?? 0;
  const priceChangePositive = priceChange >= 0;

  const formattedMarketCap = useMemo(() => {
    // Convert from Wei if needed, then format
    const mcap = fromWei(token.marketCap);
    if (isNaN(mcap) || mcap === 0) return "$0";
    return `$${formatNumber(mcap)}`;
  }, [token.marketCap]);

  const formattedPriceChange = useMemo(() => {
    if (priceChange === 0) return "0.00%";
    const change = Math.abs(priceChange);
    if (isNaN(change)) return "0.00%";
    return `${priceChangePositive ? "+" : "-"}${change.toFixed(2)}%`;
  }, [priceChange, priceChangePositive]);

  return (
    <Link href={`/token/${token.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          opacity: { duration: 0.2 },
        }}
        className={cn(
          "bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 cursor-pointer",
          "shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
          "transition-shadow duration-300",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <TokenImage
            src={token.imageUrl}
            alt={token.name}
            symbol={token.symbol}
            size={48}
            className="ring-1 ring-border/50 flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {token.name}
              </h3>
              <span className="text-xs text-muted-foreground uppercase">
                {token.symbol}
              </span>
            </div>

            {token.creator && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                by{" "}
                {token.creator.displayName ||
                  token.creator.username ||
                  `${token.creator.walletAddress.slice(0, 4)}...${token.creator.walletAddress.slice(-4)}`}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-xs text-muted-foreground">market cap</p>
            <p className="text-sm font-semibold text-primary tabular-nums">
              {formattedMarketCap}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">24h</p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums flex items-center justify-end gap-1",
                priceChangePositive ? "text-[#00ff88]" : "text-destructive",
              )}
            >
              {priceChangePositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formattedPriceChange}
            </p>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span className="tabular-nums">{token.tradesCount}</span>
            <span>trades</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="tabular-nums">{token.holdersCount}</span>
            <span>holders</span>
          </div>
        </div>

        {/* Bonding Curve */}
        {token.status === "active" && token.bondingCurveProgress < 100 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Bonding curve</span>
              <span className="text-primary font-medium tabular-nums">
                {token.bondingCurveProgress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${token.bondingCurveProgress}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
              />
            </div>
          </div>
        )}
      </motion.div>
    </Link>
  );
}
