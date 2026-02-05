"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, GraduationCap } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import { formatRelativeTime } from "@/lib/formatters";
import type { Token } from "@/types";

interface TokenCardProps {
	token: Token;
	className?: string;
}

/**
 * Mini Price Chart - Smooth area chart with gradient fill (pump.fun style)
 */
function MiniPriceChart({ data }: { data?: Array<{ timestamp: number; price: number }> }) {
	if (!data || data.length < 2) return null;
	
	// Format data for recharts
	const chartData = data.map(d => ({ value: d.price }));
	
	// Determine trend color
	const isPositive = data[data.length - 1].price >= data[0].price;
	const gradientId = `gradient-${isPositive ? 'green' : 'red'}-${Math.random().toString(36).substr(2, 9)}`;
	const strokeColor = isPositive ? "#00ff88" : "#ff4444";
	const fillColor = isPositive ? "#00ff88" : "#ff4444";
	
	return (
		<ResponsiveContainer width={70} height={28}>
			<AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={fillColor} stopOpacity={0.4} />
						<stop offset="100%" stopColor={fillColor} stopOpacity={0} />
					</linearGradient>
				</defs>
				<Area 
					type="monotone" 
					dataKey="value" 
					stroke={strokeColor}
					strokeWidth={1.5}
					fill={`url(#${gradientId})`}
					dot={false}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

/**
 * TokenCard - Pump.fun style token card with image, creator info, and bonding curve progress
 */
export function TokenCard({ token, className }: TokenCardProps) {
	// Use priceChange24h from API (it's already calculated on backend)
	const priceChange = useMemo(() => {
		const change = token.priceChange24h;
		if (change === undefined || change === null || isNaN(change)) return 0;
		return change;
	}, [token.priceChange24h]);
	
	const priceChangePositive = priceChange >= 0;

	const formattedMarketCap = useMemo(() => {
		const mcap = fromWei(token.marketCap);
		if (isNaN(mcap) || mcap === 0) return "$0";
		return `$${formatNumber(mcap)}`;
	}, [token.marketCap]);

	const formattedPriceChange = useMemo(() => {
		const change = Math.abs(priceChange);
		if (isNaN(change)) return "0.00%";
		return `${change.toFixed(2)}%`;
	}, [priceChange]);

	// Check if token is graduated
	const isGraduated = token.status === 'graduated';

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
					"bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-2 sm:p-3 cursor-pointer relative overflow-hidden",
					"hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200",
					"flex gap-2 sm:gap-3",
					className,
				)}
			>
				{/* Mini Chart - Top Right Corner BC */}
				{/* {token.priceHistory && token.priceHistory.length > 0 && (
					<div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
						<MiniPriceChart data={token.priceHistory} />
					</div>
				)} */}
				
				{/* Token Image - Square (responsive size) */}
				<div className="shrink-0">
					<TokenImage
						src={token.imageUrl}
						alt={token.name}
						symbol={token.symbol}
						size={88}
						className="rounded-lg w-16 h-16 sm:w-22 sm:h-22 object-cover"
					/>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0 flex flex-col">
					{/* Row 1: Name + Symbol + HYPE badge */}
					<div className="flex items-center gap-1 sm:gap-2 flex-wrap">
						<h3 className="font-bold text-white text-sm sm:text-[15px] leading-tight truncate max-w-30 sm:max-w-none">
							{token.name}
						</h3>
						<p className="text-[#888] text-[9px] sm:text-[10px] font-medium">({token.symbol})</p>
						{token.hypeBoostEnabled && (
							<span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] sm:text-[10px] font-medium shrink-0">
								<Zap className="h-2 w-2 sm:h-2.5 sm:w-2.5 fill-amber-400" />
								HYPE
							</span>
						)}
					</div>

					{/* Row 2: Creator + Time */}
					<div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 text-[10px] sm:text-xs">
						{creatorDisplay && (
							<span className="text-[#6b8afd] font-medium truncate max-w-20 sm:max-w-none">{creatorDisplay}</span>
						)}
						{timeAgo && <span className="text-[#666] shrink-0">{timeAgo}</span>}
					</div>

					{/* Row 3: Market Cap + Price Change */}
					<div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
						<span className="text-[#777] text-[10px] sm:text-xs font-medium shrink-0">MC</span>
						<span className="text-[#00ff88] text-xs sm:text-sm font-bold shrink-0">
							{formattedMarketCap}
						</span>
						<span
							className={cn(
								"text-[9px] sm:text-[10px] font-semibold shrink-0",
								priceChangePositive ? "text-[#00ff88]" : "text-[#ff4444]"
							)}
						>
							({priceChangePositive ? "+" : ""}{priceChange.toFixed(2)}%)
						</span>
						{/* Mini Progress Bar */}
						{/* hide this on mobile */}
						<div className="relative hidden md:block w-10 sm:w-22 h-1 sm:h-1.5 bg-[#222] rounded-full overflow-hidden shrink-0">
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${Math.max(bondingProgress > 0 ? 4 : 0, bondingProgress)}%` }}
								transition={{ duration: 0.8, ease: "easeOut" }}
								className="h-full rounded-full bg-linear-to-r from-[#00ff88] to-[#00cc6a]"
								style={{
									minWidth: bondingProgress > 0 ? '3px' : '0px',
									boxShadow: bondingProgress > 0 
										? '0 0 6px rgba(0, 255, 136, 0.4)'
										: 'none'
								}}
							/>
						</div>
						<span className="text-[9px] sm:text-[10px] hidden md:block text-[#999] font-medium shrink-0">
							{bondingProgress.toFixed(1)}%
						</span>
					</div>

					{/* Row 4: Progress Bar + Percentage + Graduated Badge */}
					<div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
						{/* Mini Progress Bar */}
						<div className="relative w-42 h-1 sm:h-1.5 bg-[#222] rounded-full overflow-hidden shrink-0 md:hidden block">
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${Math.max(bondingProgress > 0 ? 4 : 0, bondingProgress)}%` }}
								transition={{ duration: 0.8, ease: "easeOut" }}
								className="h-full rounded-full bg-linear-to-r from-[#00ff88] to-[#00cc6a]"
								style={{
									minWidth: bondingProgress > 0 ? '3px' : '0px',
									boxShadow: bondingProgress > 0 
										? '0 0 6px rgba(0, 255, 136, 0.4)'
										: 'none'
								}}
							/>
						</div>
						<span className="text-[9px] sm:text-[10px] text-[#999] font-medium shrink-0 md:hidden ">
							{bondingProgress.toFixed(1)}%
						</span>
						
						{/* Graduated Badge */}
						{isGraduated && (
							<span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[8px] sm:text-[10px] font-medium shrink-0 ml-auto">
								<GraduationCap className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
								<span className="hidden sm:inline">GRADUATED</span>
								<span className="sm:hidden">GRAD</span>
							</span>
						)}
					</div>
					{truncatedDescription && (
						<p className="text-[#666] text-[10px] sm:text-xs leading-relaxed line-clamp-1 hidden sm:block">
							{truncatedDescription}
						</p>
					)}

					 
				</div>
			</motion.div>
		</Link>
	);
}
