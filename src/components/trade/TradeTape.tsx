'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, TrendingDown, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { wsService } from '@/lib/websocket';
import type { Trade, TradeEvent } from '@/types';

interface TradeTapeProps {
    tokenId: string;
    initialTrades?: Trade[];
    className?: string;
}

/**
 * TradeTape - Live feed of recent trades
 * 
 * Features:
 * - Real-time updates via WebSocket
 * - Buy (green) / Sell (red) indicators
 * - Animated new trade entries
 * - Auto-scroll to latest
 */
export function TradeTape({ tokenId, initialTrades = [], className }: TradeTapeProps) {
    const [trades, setTrades] = useState<Trade[]>(initialTrades);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to trade events
        const unsubscribe = wsService.subscribeToTrades(tokenId, (event: TradeEvent) => {
            setTrades((prev) => [event.trade, ...prev].slice(0, 50));
        });

        return unsubscribe;
    }, [tokenId]);

    // Format wallet address
    const formatAddress = (address: string) =>
        `${address.slice(0, 4)}...${address.slice(-4)}`;

    // Format amount
    const formatAmount = (amount: string) => {
        const num = parseFloat(amount);
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
        return num.toFixed(4);
    };

    return (
        <div className={cn('bg-card border border-border rounded-xl', className)}>
            <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Live Trades
                </h3>
            </div>

            <ScrollArea ref={scrollRef} className="h-[300px]">
                <div className="p-2 space-y-1">
                    <AnimatePresence mode="popLayout">
                        {trades.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                No trades yet. Be the first!
                            </div>
                        ) : (
                            trades.map((trade, index) => (
                                <motion.div
                                    key={trade.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                                        index === 0 && 'bg-muted/50',
                                        trade.type === 'buy' ? 'border-l-2 border-l-[#00ff88]' : 'border-l-2 border-l-destructive'
                                    )}
                                >
                                    {/* Trade Type & Address */}
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                'flex items-center justify-center w-6 h-6 rounded-full',
                                                trade.type === 'buy' ? 'bg-[#00ff88]/20' : 'bg-destructive/20'
                                            )}
                                        >
                                            {trade.type === 'buy' ? (
                                                <TrendingUp className="h-3 w-3 text-[#00ff88]" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 text-destructive" />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground font-mono text-xs">
                                                {trade.user
                                                    ? (trade.user.displayName || formatAddress(trade.user.walletAddress))
                                                    : 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount & Time */}
                                    <div className="flex items-center gap-3 text-right">
                                        <span
                                            className={cn(
                                                'font-semibold tabular-nums',
                                                trade.type === 'buy' ? 'text-[#00ff88]' : 'text-destructive'
                                            )}
                                        >
                                            {trade.type === 'buy' ? '+' : '-'}{formatAmount(trade.amount)}
                                        </span>
                                        <span className="text-xs text-muted-foreground w-12 text-right">
                                            {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: false })}
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </ScrollArea>
        </div>
    );
}
