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
 * TokenCard - Clean, minimal token display
 */
export function TokenCard({ token, className }: TokenCardProps) {
    // Add null safety for priceChange24h
    const priceChange = token.priceChange24h ?? 0;
    const priceChangePositive = priceChange >= 0;

    const formattedMarketCap = useMemo(() => {
        const mcap = parseFloat(token.marketCap || '0') || 0;
        if (isNaN(mcap) || mcap === 0) return '$0';
        if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`;
        if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`;
        if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(1)}K`;
        return `$${mcap.toFixed(0)}`;
    }, [token.marketCap]);

    const formattedPriceChange = useMemo(() => {
        if (priceChange === 0) return '0.00%';
        const change = Math.abs(priceChange);
        if (isNaN(change)) return '0.00%';
        return `${priceChangePositive ? '+' : '-'}${change.toFixed(2)}%`;
    }, [priceChange, priceChangePositive]);

    return (
        <Link href={`/token/${token.id}`}>
            <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                    'bg-card border border-border rounded-xl p-4 card-hover cursor-pointer',
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {token.imageUrl ? (
                            <img
                                src={token.imageUrl.replace('0.0.0.0', 'localhost')}
                                alt={token.name}
                                className="object-cover w-full h-full"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                                {token.symbol.slice(0, 2)}
                            </div>
                        )}
                    </div>

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
                                by {token.creator.displayName || token.creator.username ||
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

                {/* Bonding Curve */}
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
