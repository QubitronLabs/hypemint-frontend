"use client";

import { motion } from "framer-motion";
import { cn, fromWei, formatNumber } from "@/lib/utils";

interface BondingCurveProgressProps {
	nativeSymbol: string;
	progress: number;
	currentAmount: string;
	targetAmount: string;
	/** Native token USD price for displaying USD values */
	nativePriceUsd?: number | null;
	/** Graduation threshold in USD (e.g., 32245) */
	graduationThresholdUsd?: number | null;
	className?: string;
}

/**
 * BondingCurveProgress - Visual indicator toward token graduation
 *
 * Shows progress toward moving from bonding curve to DEX liquidity.
 * Displays amounts in USD when native price is available.
 */
export function BondingCurveProgress({
	nativeSymbol,
	progress,
	currentAmount,
	targetAmount,
	nativePriceUsd,
	graduationThresholdUsd,
	className,
}: BondingCurveProgressProps) {
	const formattedProgress = Math.min(progress, 100);

	// Format native amount to human-readable
	const formatNativeAmount = (amount: string): number => {
		return fromWei(amount);
	};

	// Calculate USD values
	const currentNative = formatNativeAmount(currentAmount);
	const targetNative = formatNativeAmount(targetAmount);
	const hasUsdPrice = nativePriceUsd && nativePriceUsd > 0;
	const currentUsd = hasUsdPrice ? currentNative * nativePriceUsd : 0;
	const targetUsd =
		graduationThresholdUsd ||
		(hasUsdPrice ? targetNative * nativePriceUsd : 0);

	return (
		<div className={cn("space-y-1.5 sm:space-y-2", className)}>
			<div className="flex items-center justify-between text-xs sm:text-sm">
				<span className="text-muted-foreground">
					Bonding Curve Progress
				</span>
				<span className="font-semibold text-primary tabular-nums">
					{formattedProgress.toFixed(1)}%
				</span>
			</div>

			{/* Progress Bar */}
			<div className="relative h-3 bg-muted rounded-full overflow-hidden">
				<motion.div
					initial={{ width: 0 }}
					animate={{ width: `${formattedProgress}%` }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="absolute inset-y-0 left-0 bg-linear-to-r from-primary/80 to-primary rounded-full"
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

			{/* Amount labels — native amount in curve + USD graduation target */}
			<div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
				<span className="tabular-nums truncate mr-2">
					{formatNumber(currentNative)} {nativeSymbol} in curve
				</span>
				<span className="tabular-nums shrink-0">
					{targetUsd > 0
						? `$${formatNumber(targetUsd)} to graduate`
						: `${formatNumber(targetNative)} ${nativeSymbol} to graduate`}
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
