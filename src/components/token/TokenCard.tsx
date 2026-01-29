"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Users, Activity, Zap } from "lucide-react";
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import type { Token } from "@/types";

interface TokenCardProps {
	token: Token;
	className?: string;
}

/**
 * TokenCard - Clean, minimal token display with bonding curve progress
 */
export function TokenCard({ token, className }: TokenCardProps) {
	// Add null safety for priceChange24h
	const priceChange = token.priceChange24h ?? 0;
	const priceChangePositive = priceChange >= 0;

	const formattedMarketCap = useMemo(() => {
		// Convert from Wei if needed, then format
		const mcap = fromWei(token.marketCap);
		if (isNaN(mcap) || mcap === 0) return "$0";
		return `$${formatNumber(mcap)}`;
	}, [token.marketCap]);

	const formattedPriceChange = useMemo(() => {
		if (priceChange === 0) return "0.00%";
		const change = Math.abs(priceChange);
		if (isNaN(change)) return "0.00%";
		return `${priceChangePositive ? "" : "-"}${change.toFixed(2)}%`;
	}, [priceChange, priceChangePositive]);

	// Bonding curve progress (0-100)
	const bondingProgress = token.bondingCurveProgress ?? 0;
	const showBondingCurve = token.status === "active" && bondingProgress < 100;

	return (
		<Link href={`/token/${token.id}`}>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				whileHover={{ scale: 1.02, y: -2 }}
				whileTap={{ scale: 0.98 }}
				transition={{
					type: "spring",
					stiffness: 400,
					damping: 25,
					opacity: { duration: 0.2 },
				}}
				className={cn(
					"bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 cursor-pointer",
					"shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
					"transition-shadow duration-300",
					className,
				)}
			>
				{/* Header */}
				<div className="flex items-start gap-2 sm:gap-3">
					<TokenImage
						src={token.imageUrl}
						alt={token.name}
						symbol={token.symbol}
						size={40}
						className="ring-1 ring-border/50 shrink-0 w-10 h-10 sm:w-12 sm:h-12"
					/>

					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5 sm:gap-2">
							<h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
								{token.name}
							</h3>
							<span className="text-[10px] sm:text-xs text-muted-foreground uppercase shrink-0">
								{token.symbol}
							</span>
							{/* HypeBoost Badge */}
							{token.hypeBoostEnabled && (
								<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] sm:text-[10px] font-medium shrink-0">
									<Zap className="h-2.5 w-2.5 fill-amber-400" />
									HYPE
								</span>
							)}
						</div>

						{token.creator && (
							<p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
								by{" "}
								{token.creator.displayName ||
									token.creator.username ||
									`${token.creator.walletAddress.slice(0, 4)}...${token.creator.walletAddress.slice(-4)}`}
							</p>
						)}
					</div>
				</div>

				{/* Market Cap & Bonding Curve Progress (Inline like reference) */}
				<div className="mt-3 sm:mt-4">
					<div className="flex items-center gap-2">
						<span className="text-[10px] sm:text-xs text-muted-foreground">MC</span>
						<span className="text-xs sm:text-sm font-semibold text-primary tabular-nums">
							{formattedMarketCap}
						</span>
						
						{/* Inline Bonding Curve Progress Bar */}
						{showBondingCurve && (
							<>
								<div className="flex-1 h-1.5 sm:h-2 bg-muted/30 rounded-full overflow-hidden">
									<motion.div
										initial={{ width: 0 }}
										animate={{ width: `${bondingProgress}%` }}
										transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
										className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500"
										style={{
											boxShadow: "0 0 8px rgba(251, 191, 36, 0.4)",
										}}
									/>
								</div>
								<span className={cn(
									"text-[10px] sm:text-xs font-medium tabular-nums shrink-0",
									priceChangePositive ? "text-[#00ff88]" : "text-destructive"
								)}>
									{bondingProgress.toFixed(1)}%
								</span>
							</>
						)}
						
						{/* Show 24h change if no bonding curve */}
						{!showBondingCurve && (
							<div className="ml-auto flex items-center gap-1">
								<span
									className={cn(
										"text-xs sm:text-sm font-semibold tabular-nums flex items-center gap-0.5",
										priceChangePositive ? "text-[#00ff88]" : "text-destructive",
									)}
								>
									{priceChangePositive ? "↑" : "↓"}
									{formattedPriceChange}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Bottom Stats */}
				<div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/50">
					<div className="flex items-center gap-3 sm:gap-4">
						<div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
							<Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
							<span className="tabular-nums">{token.tradesCount}</span>
							<span>trades</span>
						</div>
						<div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
							<Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
							<span className="tabular-nums">{token.holdersCount}</span>
							<span>holders</span>
						</div>
					</div>
					
					{/* 24h change on right when bonding curve is shown */}
					{showBondingCurve && (
						<div className="flex items-center gap-1">
							<span className="text-[10px] sm:text-xs text-muted-foreground">24h</span>
							<span
								className={cn(
									"text-[10px] sm:text-xs font-semibold tabular-nums flex items-center gap-0.5",
									priceChangePositive ? "text-[#00ff88]" : "text-destructive",
								)}
							>
								{priceChangePositive ? (
									<TrendingUp className="h-2.5 w-2.5" />
								) : (
									<TrendingDown className="h-2.5 w-2.5" />
								)}
								{formattedPriceChange}
							</span>
						</div>
					)}
				</div>
			</motion.div>
		</Link>
	);
}
