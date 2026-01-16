'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BondingCurveProgressProps {
    progress: number;
    currentAmount: string;
    targetAmount: string;
    className?: string;
}

/**
 * BondingCurveProgress - Visual indicator toward token graduation
 * 
 * Shows progress toward moving from bonding curve to DEX liquidity
 */
export function BondingCurveProgress({
    progress,
    currentAmount,
    targetAmount,
    className,
}: BondingCurveProgressProps) {
    const formattedProgress = Math.min(progress, 100);

    const formatAmount = (amount: string) => {
        const num = parseFloat(amount);
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
        return num.toFixed(2);
    };

    return (
        <div className={cn('space-y-2', className)}>
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bonding Curve Progress</span>
                <span className="font-semibold text-primary tabular-nums">
                    {formattedProgress.toFixed(1)}%
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${formattedProgress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary rounded-full"
                />

                {/* Glow effect */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-y-0 left-0 bg-primary/30 rounded-full blur-sm"
                    style={{ width: `${formattedProgress}%` }}
                />
            </div>

            {/* Amount labels */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">
                    {formatAmount(currentAmount)} SOL in curve
                </span>
                <span className="tabular-nums">
                    {formatAmount(targetAmount)} SOL to graduate
                </span>
            </div>

            {/* Graduation message */}
            {formattedProgress >= 100 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm text-primary font-medium"
                >
                    🎉 Graduated to DEX!
                </motion.div>
            )}
        </div>
    );
}
