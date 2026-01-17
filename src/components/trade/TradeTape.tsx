'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
    // Ensure initialTrades is always an array
    const safeInitialTrades = Array.isArray(initialTrades) ? initialTrades : [];
    // If trade has nested user, flatten it for consistency with streaming format or handle both
    const normalizedInitialTrades = safeInitialTrades.map(t => ({
        ...t,
        username: t.user?.displayName || t.user?.username || (t.user?.walletAddress ? `${t.user.walletAddress.slice(0, 4)}...${t.user.walletAddress.slice(-4)}` : "Unknown")
    }));

    const [trades, setTrades] = useState<any[]>(normalizedInitialTrades);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to trade events
        const unsubscribe = wsService.subscribeToTrades(tokenId, (event: TradeEvent) => {
            // Map event payload to display format
            // Event payload from backend: { tradeId, userId, username, userAvatar, type, amount, price, totalValue, timestamp }
            const newTrade = {
                id: event.tradeId,
                type: event.type,
                amount: event.amount, // This is in Wei string
                price: event.price,
                createdAt: event.timestamp || new Date().toISOString(),
                username: event.username, // Direct username from improved backend
                user: {
                    walletAddress: event.userId, // We don't have wallet addr in event, but we use username
                    displayName: event.username,
                    avatarUrl: event.userAvatar
                }
            };
            setTrades((prev) => [newTrade, ...prev].slice(0, 50));
        });

        return unsubscribe;
    }, [tokenId]);

    // Format amount (assume 18 decimals)
    const formatAmount = (amount: string | undefined | null) => {
        if (!amount) return '0';
        try {
            // If amount is massive (Wei), divide by 1e18
            let val = parseFloat(amount);
            if (amount.length > 10) { // Naive check for Wei strings (usually > 18 chars)
                // Use BigInt for precision if needed, but for display simplified division is fine
                // But JS numbers lose precision. 
                // Better: string manipulation
                if (amount.includes('.')) {
                    // It's already decimal?
                } else {
                    // It's integer Wei
                    val = parseFloat(amount) / 1e18;
                }
            }

            if (isNaN(val)) return '0';

            if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
            if (val < 0.0001 && val > 0) return '<0.0001';

            return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
        } catch (e) {
            return '0';
        }
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
                                    key={trade.id || Math.random()}
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
                                                {trade.username || trade.user?.displayName || "Unknown"}
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
                                            {trade.createdAt ? formatDistanceToNow(new Date(trade.createdAt), { addSuffix: false }) : 'Just now'}
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
