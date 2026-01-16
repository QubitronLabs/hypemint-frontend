'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';

interface TokenCardProps {
    token: Token;
    className?: string;
}

/**
 * TokenCard - Displays token info in a compact card format
 * 
 * Inspired by pump.fun's token grid with:
 * - Token image with fallback
 * - Name, symbol, creator info
 * - Market cap and price change
 * - Hover animations
 */
export function TokenCard({ token, className }: TokenCardProps) {
    const priceChangePositive = token.priceChange24h >= 0;

    const formattedMarketCap = useMemo(() => {
        const mcap = parseFloat(token.marketCap);
        if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`;
        if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`;
        if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(2)}K`;
        return `$${mcap.toFixed(2)}`;
    }, [token.marketCap]);

    const formattedPriceChange = useMemo(() => {
        const change = Math.abs(token.priceChange24h);
        return `${priceChangePositive ? '+' : '-'}${change.toFixed(2)}%`;
    }, [token.priceChange24h, priceChangePositive]);

    return (
        <Link href={`/token/${token.id}`}>
            <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    'group relative bg-card border border-border rounded-xl p-4 card-hover cursor-pointer',
                    'transition-all duration-200',
                    className
                )}
            >
                {/* Header: Image + Name */}
                <div className="flex items-start gap-3">
                    {/* Token Image */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {token.imageUrl ? (
                            <Image
                                src={token.imageUrl}
                                alt={token.name}
                                fill
                                className="object-cover"
                                sizes="48px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                                {token.symbol.slice(0, 2)}
                            </div>
                        )}
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                                {token.name}
                            </h3>
                            <span className="text-xs text-muted-foreground uppercase">
                                {token.symbol}
                            </span>
                        </div>

                        {/* Creator */}
                        {token.creator && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                by {token.creator.displayName || token.creator.username ||
                                    `${token.creator.walletAddress.slice(0, 4)}...${token.creator.walletAddress.slice(-4)}`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between mt-4">
                    {/* Market Cap */}
                    <div>
                        <p className="text-xs text-muted-foreground">market cap</p>
                        <p className="text-sm font-semibold text-primary tabular-nums">
                            {formattedMarketCap}
                        </p>
                    </div>

                    {/* 24h Change */}
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">24h</p>
                        <p
                            className={cn(
                                'text-sm font-semibold tabular-nums flex items-center justify-end gap-1',
                                priceChangePositive ? 'text-[#00ff88]' : 'text-destructive'
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

                {/* Bonding Curve Progress (if not graduated) */}
                {token.status === 'active' && token.bondingCurveProgress < 100 && (
                    <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Bonding curve</span>
                            <span className="text-primary font-medium tabular-nums">
                                {token.bondingCurveProgress.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${token.bondingCurveProgress}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="h-full bg-primary rounded-full"
                            />
                        </div>
                    </div>
                )}
            </motion.div>
        </Link>
    );
}
