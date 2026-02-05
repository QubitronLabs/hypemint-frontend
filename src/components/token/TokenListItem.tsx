"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, GraduationCap, Star } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { TokenImage } from "@/components/ui/token-image";
import { formatRelativeTime } from "@/lib/formatters";
import type { Token } from "@/types";

interface TokenListItemProps {
	token: Token;
	index: number;
	className?: string;
}

/**
 * Mini Sparkline Chart for list view
 */
function MiniSparkline({ data }: { data?: Array<{ timestamp: number; price: number }> }) {
	if (!data || data.length < 2) {
		return <div className="w-full h-8 bg-[#1a1a1a] rounded" />;
	}
	
	const chartData = data.map(d => ({ value: d.price }));
	const isPositive = data[data.length - 1].price >= data[0].price;
	const gradientId = `sparkline-${isPositive ? 'green' : 'red'}-${Math.random().toString(36).substr(2, 9)}`;
	const strokeColor = isPositive ? "#00ff88" : "#ff4444";
	const fillColor = isPositive ? "#00ff88" : "#ff4444";
	
	return (
		<ResponsiveContainer width="100%" height={32}>
			<AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
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
 * Format price change with color
 */
function PriceChange({ value }: { value: number }) {
	const isPositive = value >= 0;
	return (
		<span className={cn(
			"text-xs font-medium whitespace-nowrap",
			isPositive ? "text-[#00ff88]" : "text-[#ff4444]"
		)}>
			{isPositive ? "+" : ""}{value.toFixed(2)}%
		</span>
	);
}

/**
 * TokenListItem - Pump.fun style list view with flexible columns
 */
export function TokenListItem({ token, index, className }: TokenListItemProps) {
	// Parse price changes safely
	const priceChange24h = useMemo(() => {
		const change = token.priceChange24h;
		if (change === undefined || change === null) return 0;
		const num = typeof change === 'string' ? parseFloat(change) : change;
		return isNaN(num) ? 0 : num;
	}, [token.priceChange24h]);

	const priceChange5m = useMemo(() => {
		const change = token.priceChange5m;
		if (change === undefined || change === null) return 0;
		const num = typeof change === 'string' ? parseFloat(change) : change;
		return isNaN(num) ? 0 : num;
	}, [token.priceChange5m]);

	const priceChange1h = useMemo(() => {
		const change = token.priceChange1h;
		if (change === undefined || change === null) return 0;
		const num = typeof change === 'string' ? parseFloat(change) : change;
		return isNaN(num) ? 0 : num;
	}, [token.priceChange1h]);

	const priceChange6h = useMemo(() => {
		const change = token.priceChange6h;
		if (change === undefined || change === null) return 0;
		const num = typeof change === 'string' ? parseFloat(change) : change;
		return isNaN(num) ? 0 : num;
	}, [token.priceChange6h]);

	const formattedMarketCap = useMemo(() => {
		const mcap = fromWei(token.marketCap);
		if (isNaN(mcap) || mcap === 0) return "$0";
		return `$${formatNumber(mcap)}`;
	}, [token.marketCap]);

	const formattedVolume = useMemo(() => {
		const vol = parseFloat(token.volume24h || "0") / 1e18;
		if (isNaN(vol) || vol === 0) return "$0";
		return `$${formatNumber(vol)}`;
	}, [token.volume24h]);

	const isGraduated = token.status === 'graduated';

	const age = useMemo(() => {
		if (!token.createdAt) return "-";
		const date = new Date(token.createdAt);
		return formatRelativeTime(date);
	}, [token.createdAt]);

	return (
		<Link href={`/token/${token.id}`} className="block w-full">
			<motion.div
				initial={{ opacity: 0, y: 5 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: index * 0.02 }}
				className={cn(
					"bg-[#111] border-b border-[#222] px-4 py-3 cursor-pointer",
					"hover:bg-[#1a1a1a] transition-all duration-150",
					"flex items-center gap-3 min-w-300",
					className,
				)}
			>
				{/* Rank + Image + Name (2.5 parts) */}
				<div className="flex items-center gap-3 flex-[2.5] min-w-0">
					<span className="text-[#666] text-sm font-medium w-7 text-center shrink-0">
						#{index + 1}
					</span>
					<TokenImage
						src={token.imageUrl}
						alt={token.name}
						symbol={token.symbol}
						size={36}
						className="rounded-full w-9 h-9 object-cover shrink-0"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-1">
							<span className="font-semibold text-white text-sm truncate">
								{token.name}
							</span>
							{token.hypeBoostEnabled && (
								<Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
							)}
							{isGraduated && (
								<GraduationCap className="h-3.5 w-3.5 text-green-400 shrink-0" />
							)}
						</div>
						<span className="text-[#666] text-xs">{token.symbol}</span>
					</div>
				</div>

				{/* Graph (1.5 parts) */}
				<div className="flex-[1.5]">
					<MiniSparkline data={token.priceHistory} />
				</div>

				{/* MCAP (1 part) */}
				<div className="flex-1 text-right">
					<span className="text-[#00ff88] text-sm font-semibold">{formattedMarketCap}</span>
				</div>

				{/* Age (0.5 part) */}
				<div className="flex-[0.5] text-center">
					<span className="text-[#f8f8f8] text-xs">{age}</span>
				</div>

				{/* TXNS (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<span className="text-[#f8f8f8] text-sm">{formatNumber(token.tradesCount || 0)}</span>
				</div>

				{/* 24H VOL (1 part) */}
				<div className="flex-1 text-right">
					<span className="text-[#f8f8f8] text-sm">{formattedVolume}</span>
				</div>

				{/* TRADERS/HOLDERS (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<span className="text-[#f8f8f8] text-sm">{token.holdersCount || 0}</span>
				</div>

				{/* 5M (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<PriceChange value={priceChange5m} />
				</div>

				{/* 1H (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<PriceChange value={priceChange1h} />
				</div>

				{/* 6H (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<PriceChange value={priceChange6h} />
				</div>

				{/* 24H (0.75 part) */}
				<div className="flex-[0.75] text-right">
					<PriceChange value={priceChange24h} />
				</div>

				{/* Star/Watchlist (0.4 part) */}
				<div className="flex flex-[0.4] justify-center">
					<Star className="h-4 w-4 text-[#f8f8f8] hover:text-amber-400 cursor-pointer transition-colors" />
				</div>
			</motion.div>
		</Link>
	);
}
