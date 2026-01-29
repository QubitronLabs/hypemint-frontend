"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import { formatRelativeTime } from "@/lib/formatters";
import type { Token } from "@/types";

interface TokenCardProps {
	token: Token;
	className?: string;
}

/**
 * TokenCard - Pump.fun style token card with image, creator info, and bonding curve progress
 */
export function TokenCard({ token, className }: TokenCardProps) {
	// Add null safety for priceChange24h
	const priceChange = token.priceChange24h ?? 0;
	const priceChangePositive = priceChange >= 0;

	const formattedMarketCap = useMemo(() => {
		const mcap = fromWei(token.marketCap);
		if (isNaN(mcap) || mcap === 0) return "$0";
		return `$${formatNumber(mcap)}`;
	}, [token.marketCap]);

	const formattedPriceChange = useMemo(() => {
		if (priceChange === 0) return "0.00%";
		const change = Math.abs(priceChange);
		if (isNaN(change)) return "0.00%";
		return `${change.toFixed(2)}%`;
	}, [priceChange]);

	// Bonding curve progress (0-100) - from backend API
	const bondingProgress = useMemo(() => {
		const progress = token.bondingCurveProgress ?? 0;
		// Ensure it's a valid number between 0-100
		return Math.min(100, Math.max(0, progress));
	}, [token.bondingCurveProgress]);

	// Format creator display name
	const creatorDisplay = useMemo(() => {
		if (!token.creator) return null;
		if (token.creator.displayName) return token.creator.displayName;
		if (token.creator.username) return token.creator.username;
		if (token.creator.walletAddress) {
			return `${token.creator.walletAddress.slice(0, 6)}`;
		}
		return null;
	}, [token.creator]);

	// Format relative time
	const timeAgo = useMemo(() => {
		if (!token.createdAt) return "";
		const date = new Date(token.createdAt);
		return formatRelativeTime(date);
	}, [token.createdAt]);

	// Truncate description
	const truncatedDescription = useMemo(() => {
		if (!token.description) return "";
		if (token.description.length <= 50) return token.description;
		return token.description.slice(0, 47) + "...";
	}, [token.description]);

	return (
		<Link href={`/token/${token.id}`}>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				// whileHover={{ scale: 1.01 }}
				whileTap={{ scale: 0.99 }}
				transition={{
					type: "spring",
					stiffness: 400,
					damping: 25,
					opacity: { duration: 0.2 },
				}}
				className={cn(
					"bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 cursor-pointer",
					"hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200",
					"flex gap-3",
					className,
				)}
			>
				{/* Token Image - Square */}
				<div className="shrink-0">
					<TokenImage
						src={token.imageUrl}
						alt={token.name}
						symbol={token.symbol}
						size={88}
						className="rounded-lg w-[88px] h-[88px] object-cover"
					/>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0 flex flex-col">
					{/* Row 1: Name + HYPE badge + Progress bar at end */}
					<div className="flex items-center gap-2">
						<h3 className="font-bold text-white text-[15px] leading-tight truncate">
							{token.name}
						</h3>
						{token.hypeBoostEnabled && (
							<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium shrink-0">
								<Zap className="h-2.5 w-2.5 fill-amber-400" />
								HYPE
							</span>
						)}
						{/* Progress Bar - at the end of first row */}
						<div className="ml-auto flex items-center gap-1.5 shrink-0">
							<div className="w-[150px] h-[10px] bg-[#333] rounded-full overflow-hidden">
								<motion.div
									initial={{ width: 0 }}
									animate={{ width: `${bondingProgress}%` }}
									transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
									className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-[#00cc6a]"
								/>
							</div>
							<span className="text-[10px] text-[#888] font-medium">
								{bondingProgress.toFixed(1)}%
							</span>
						</div>
					</div>

					{/* Row 2: Symbol */}
					<p className="text-[#888] text-sm font-medium">{token.symbol}</p>

					{/* Row 3: Creator + Time */}
					<div className="flex items-center gap-1.5 mt-1 text-xs">
						{/* <span className="text-sm">🐸</span> */}
						{creatorDisplay && (
							<span className="text-[#6b8afd] font-medium">{creatorDisplay}</span>
						)}
						{timeAgo && <span className="text-[#666]">{timeAgo}</span>}
					</div>

					{/* Row 4: Market Cap + Price Change */}
					<div className="flex items-center gap-2 mt-1.5">
						<span className="text-[#777] text-xs font-medium shrink-0">MC</span>
						<span className="text-[#00ff88] text-sm font-bold shrink-0">
							{formattedMarketCap}
						</span>

						{/* Price Change at end */}
						<span
							className={cn(
								"text-xs font-semibold shrink-0 ml-auto",
								priceChangePositive ? "text-[#00ff88]" : "text-[#ff4444]"
							)}
						>
							{priceChangePositive ? "↑" : "↓"}
							{formattedPriceChange}
						</span>
					</div>

					{/* Row 5: Description */}
					{truncatedDescription && (
						<p className="text-[#666] text-xs mt-1 leading-relaxed line-clamp-1">
							{truncatedDescription}
						</p>
					)}
				</div>
			</motion.div>
		</Link>
	);
}
