"use client";

import { ExternalLink, ArrowUpRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Known DEX metadata keyed by display name */
const DEX_METADATA: Record<
  string,
  { baseSwapUrl: string; logo?: string }
> = {
  "QuickSwap V2": {
    baseSwapUrl: "https://quickswap.exchange/#/swap",
  },
  "PancakeSwap V2": {
    baseSwapUrl: "https://pancakeswap.finance/swap",
  },
  "Uniswap V2": {
    baseSwapUrl: "https://app.uniswap.org/#/swap",
  },
  "Camelot V2": {
    baseSwapUrl: "https://app.camelot.exchange/swap",
  },
  "TraderJoe V2": {
    baseSwapUrl: "https://traderjoexyz.com/avalanche/trade",
  },
  Velodrome: {
    baseSwapUrl: "https://app.velodrome.finance/swap",
  },
};

interface PostGraduationWidgetProps {
  tokenAddress: string;
  poolAddress?: string | null;
  dexName?: string | null;
  chainId?: number;
}

/**
 * PostGraduationWidget — links users to the DEX pool after graduation.
 */
export function PostGraduationWidget({
  tokenAddress,
  poolAddress,
  dexName,
  chainId,
}: PostGraduationWidgetProps) {
  const name = dexName ?? "DEX";
  const meta = DEX_METADATA[name];

  // Build a swap URL with the token as output
  const swapUrl = meta
    ? `${meta.baseSwapUrl}?outputCurrency=${tokenAddress}`
    : poolAddress
      ? `https://dexscreener.com/search?q=${poolAddress}`
      : `https://dexscreener.com/search?q=${tokenAddress}`;

  // Block explorer link for the pool
  const explorerUrl = (() => {
    if (!poolAddress) return null;
    const explorers: Record<number, string> = {
      1: "https://etherscan.io",
      137: "https://polygonscan.com",
      80002: "https://amoy.polygonscan.com",
      42161: "https://arbiscan.io",
      56: "https://bscscan.com",
      43114: "https://snowtrace.io",
      10: "https://optimistic.etherscan.io",
    };
    const base = chainId ? explorers[chainId] : null;
    return base ? `${base}/address/${poolAddress}` : null;
  })();

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-card to-emerald-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold text-sm text-amber-300">
          Token Graduated!
        </h3>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        This token has graduated from the bonding curve and is now trading on{" "}
        <span className="text-foreground font-medium">{name}</span>. Liquidity
        has been locked and LP tokens burned.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
          asChild
        >
          <a href={swapUrl} target="_blank" rel="noopener noreferrer">
            Trade on {name}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </Button>

        {explorerUrl && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View Pool
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
