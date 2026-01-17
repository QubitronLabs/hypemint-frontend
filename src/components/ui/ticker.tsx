'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Token } from '@/types';

interface TickerProps {
    tokens: Token[];
    speed?: number;
}

export function Ticker({ tokens, speed = 20 }: TickerProps) {
    // Duplicate list for seamless loop
    const tickerItems = [...tokens, ...tokens, ...tokens];

    return (
        <div className="w-full overflow-hidden bg-black/20 backdrop-blur-sm border-y border-white/5 py-2">
            <motion.div
                animate={{ x: [0, -1000] }}
                transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration: speed,
                }}
                className="flex items-center gap-8 whitespace-nowrap"
            >
                {tickerItems.map((token, i) => {
                    const priceChange = token.priceChange24h || 0;
                    return (
                        <div key={`${token.id}-${i}`} className="flex items-center gap-2 text-xs font-mono">
                            <span className="font-bold text-white/90">{token.symbol}</span>
                            <span className={cn(
                                "flex items-center",
                                priceChange >= 0 ? "text-[#00ff88]" : "text-red-500"
                            )}>
                                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                            </span>
                            <span className="text-white/40">|</span>
                        </div>
                    )
                })}
            </motion.div>
        </div>
    );
}
