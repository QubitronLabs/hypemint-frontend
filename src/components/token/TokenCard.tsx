"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import { formatRelativeTime } from "@/lib/formatters";
import type { Token } from "@/types";

interface TokenCardProps {
	token: Token;
	className?: string;
}

/**
 * Mini Price Chart - Proper Recharts BC
 */
function MiniPriceChart({ data }: { data?: Array<{ timestamp: number; price: number }> }) {
	if (!data || data.length < 2) return null;
	
	// Format data for recharts
	const chartData = data.map(d => ({ value: d.price }));
	
	// Determine trend color
	const isPositive = data[data.length - 1].price >= data[0].price;
	const strokeColor = isPositive ? "#00ff88" : "#ff4444";
	
	return (
		<ResponsiveContainer width={80} height={30}>
			<LineChart data={chartData}>
				<Line 
					type="monotone" 
					dataKey="value" 
					stroke={strokeColor}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

/**
 * TokenCard - Pump.fun style token card with image, creator info, and bonding curve progress
 */
export function TokenCard({ token, className }: TokenCardProps) {
	// Calculate price change from initial to current (actual gain/loss %) BC
	const priceChange = useMemo(() => {
		const currentPrice = parseFloat(token.currentPrice);
		const initialPrice = parseFloat(token.initialPrice);
		
		if (!initialPrice || !currentPrice || initialPrice === 0) return 0;
		
		return ((currentPrice - initialPrice) / initialPrice) * 100;
	}, [token.currentPrice, token.initialPrice]);
	
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
					"bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 cursor-pointer relative overflow-hidden",
					"hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200",
					"flex gap-3",
					className,
				)}
			>
				{/* Mini Chart - Top Right Corner BC */}
				{token.priceHistory && token.priceHistory.length > 0 && (
					<div className="absolute top-2 right-2 z-10">
						<MiniPriceChart data={token.priceHistory} />
					</div>
				)}
				
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
					{/* Row 1: Name + HYPE badge */}
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
					</div>

					{/* Row 2: Symbol */}
					<p className="text-[#888] text-sm font-medium">{token.symbol}</p>

					{/* Row 3: Creator + Time */}
					<div className="flex items-center gap-1.5 mt-1 text-xs">
						{creatorDisplay && (
							<span className="text-[#6b8afd] font-medium">{creatorDisplay}</span>
						)}
						{timeAgo && <span className="text-[#666]">{timeAgo}</span>}
					</div>

					{/* Row 4: Market Cap + Price Change */}
					<div className="flex items-center gap-2 mt-1.5 mb-2">
						<span className="text-[#777] text-xs font-medium shrink-0">MC</span>
						<span className="text-[#00ff88] text-sm font-bold shrink-0">
							{formattedMarketCap}
						&nbsp;&nbsp;
							<span
							className={cn(
								"text-[10px] font-semibold shrink-0 ml-auto",
								priceChangePositive ? "text-[#00ff88]" : "text-[#ff4444]"
							)}
						>
							(
							{priceChangePositive ? "↑" : "↓"}
							{formattedPriceChange}
							)
						</span>
						</span>
						{/* Price Change */}
					</div>

					{/* Progress Bar - Glassmorphism Style BC! */}
					<div className="relative">
						{/* Background track with subtle gradient */}
						<div className="w-full h-2 bg-gradient-to-r from-[#1a1a1a] via-[#222] to-[#1a1a1a] rounded-full border border-[#333] overflow-hidden backdrop-blur-sm">
							{/* Animated progress bar with glow */}
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${bondingProgress}%` }}
								transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
								className="relative h-full rounded-full bg-gradient-to-r from-[#00ff88] via-[#00dd77] to-[#00cc6a]"
								style={{
									boxShadow: bondingProgress > 0 
										? '0 0 12px rgba(0, 255, 136, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
										: 'none'
								}}
							>
								{/* Shine effect saale */}
								{bondingProgress > 5 && (
									<div 
										className="absolute inset-0 rounded-full"
										style={{
											background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
										}}
									/>
								)}
							</motion.div>
						</div>
						{/* Progress percentage */}
						<span className="absolute -top-5 right-0 text-[10px] text-[#999] font-bold">
							{bondingProgress.toFixed(1)}%
						</span>
					</div>

					{/* Row 5: Description */}
					{truncatedDescription && (
						<p className="text-[#666] text-xs mt-2 leading-relaxed line-clamp-1">
							{truncatedDescription}
						</p>
					)}
				</div>
			</motion.div>
		</Link>
	);
}
