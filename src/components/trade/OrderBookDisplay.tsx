"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useOrderBook } from "@/hooks/useOrders";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderBookDisplayProps {
  tokenId: string;
  depth?: number;
  className?: string;
}

export function OrderBookDisplay({
  tokenId,
  depth = 10,
  className,
}: OrderBookDisplayProps) {
  const { data: orderBook, isLoading, error } = useOrderBook(tokenId, depth);

  const maxAmount = useMemo(() => {
    if (!orderBook) return 0;
    const allAmounts = [...orderBook.bids, ...orderBook.asks].map((level) =>
      parseFloat(level.amount),
    );
    return Math.max(...allAmounts, 1);
  }, [orderBook]);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: depth }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error || !orderBook) {
    return (
      <div className={cn("text-center text-muted-foreground py-4", className)}>
        Failed to load order book
      </div>
    );
  }

  const formatPrice = (priceWei: string) => {
    const price = parseFloat(priceWei) / 1e18;
    if (price < 0.00001) return price.toExponential(2);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatAmount = (amountWei: string) => {
    const amount = parseFloat(amountWei) / 1e18;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(2);
  };

  return (
    <div className={cn("font-mono text-xs", className)}>
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 px-2 py-1 text-muted-foreground border-b">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sell orders) - reversed so lowest is at bottom */}
      <div className="space-y-px">
        {orderBook.asks
          .slice()
          .reverse()
          .map((level, i) => {
            const widthPercent = (parseFloat(level.amount) / maxAmount) * 100;
            return (
              <div
                key={`ask-${i}`}
                className="relative grid grid-cols-3 gap-2 px-2 py-1"
              >
                <div
                  className="absolute inset-0 bg-red-500/10"
                  style={{ width: `${widthPercent}%`, right: 0, left: "auto" }}
                />
                <span className="relative text-red-400">
                  {formatPrice(level.price)}
                </span>
                <span className="relative text-right">
                  {formatAmount(level.amount)}
                </span>
                <span className="relative text-right text-muted-foreground">
                  {level.orderCount}
                </span>
              </div>
            );
          })}
      </div>

      {/* Spread */}
      <div className="px-2 py-2 text-center border-y bg-muted/30">
        <span className="text-muted-foreground">Spread: </span>
        <span className="font-semibold">{formatPrice(orderBook.spread)}</span>
      </div>

      {/* Bids (buy orders) */}
      <div className="space-y-px">
        {orderBook.bids.map((level, i) => {
          const widthPercent = (parseFloat(level.amount) / maxAmount) * 100;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 gap-2 px-2 py-1"
            >
              <div
                className="absolute inset-0 bg-green-500/10"
                style={{ width: `${widthPercent}%` }}
              />
              <span className="relative text-green-400">
                {formatPrice(level.price)}
              </span>
              <span className="relative text-right">
                {formatAmount(level.amount)}
              </span>
              <span className="relative text-right text-muted-foreground">
                {level.orderCount}
              </span>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {orderBook.bids.length === 0 && orderBook.asks.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No orders yet
        </div>
      )}
    </div>
  );
}
