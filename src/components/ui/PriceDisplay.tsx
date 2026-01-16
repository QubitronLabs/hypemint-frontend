'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceDisplayProps {
    price: string | number;
    change?: number;
    currency?: string;
    size?: 'sm' | 'md' | 'lg';
    showChange?: boolean;
    className?: string;
}

/**
 * PriceDisplay - Animated price display with change indicator
 * 
 * Features:
 * - Formatted price with currency symbol
 * - Animated value transitions
 * - Color-coded change percentage
 */
export function PriceDisplay({
    price,
    change = 0,
    currency = '$',
    size = 'md',
    showChange = true,
    className,
}: PriceDisplayProps) {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    const isPositive = change >= 0;

    const formatPrice = (value: number) => {
        if (value === 0) return `${currency}0.00`;

        // Handle very small prices (common in memecoins)
        if (value < 0.000001) {
            return `${currency}${value.toExponential(2)}`;
        }
        if (value < 0.01) {
            return `${currency}${value.toFixed(8)}`;
        }
        if (value < 1) {
            return `${currency}${value.toFixed(6)}`;
        }
        if (value < 1000) {
            return `${currency}${value.toFixed(4)}`;
        }
        if (value < 1000000) {
            return `${currency}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        }
        return `${currency}${(value / 1000000).toFixed(2)}M`;
    };

    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-2xl',
    };

    const changeSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <AnimatePresence mode="wait">
                <motion.span
                    key={numericPrice}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        'font-semibold tabular-nums text-foreground',
                        sizeClasses[size]
                    )}
                >
                    {formatPrice(numericPrice)}
                </motion.span>
            </AnimatePresence>

            {showChange && change !== 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                        'flex items-center gap-0.5 font-medium tabular-nums',
                        changeSizeClasses[size],
                        isPositive ? 'text-[#00ff88]' : 'text-destructive'
                    )}
                >
                    {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                    ) : (
                        <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
                </motion.div>
            )}
        </div>
    );
}
