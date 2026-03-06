"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Filter } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, fromWei, formatNumber } from "@/lib/utils";
import { wsService } from "@/lib/websocket";
import { getTxUrl, isSolanaChain } from "@/lib/wagmi/config";
import type { Trade, TradeEvent } from "@/types";

interface TradeTapeProps {
	tokenId: string;
	tokenSymbol?: string;
	nativeTokenSymbol?: string;
	initialTrades?: Trade[];
	chainId?: number;
	className?: string;
}

type FilterOption = "all" | "0.05" | "0.1" | "0.5" | "1";

/**
 * TradeTape - Live feed of recent trades as table
 *
 * Features:
 * - Table format with avatar, username, type, amounts, time, txHash
 * - Real-time updates via WebSocket
 * - Filter by trade size
 */
export function TradeTape({
	tokenId,
	nativeTokenSymbol,
	tokenSymbol = "TOKEN",
	initialTrades = [],
	chainId,
	className,
}: TradeTapeProps) {
	const [filter, setFilter] = useState<FilterOption>("all");

	// Ensure initialTrades is always an array
	const safeInitialTrades = useMemo(
		() => (Array.isArray(initialTrades) ? initialTrades : []),
		[initialTrades],
	);

	// Normalize trades helper
	const normalizeTrades = useCallback((trades: typeof safeInitialTrades) => {
		return trades.map((t) => ({
			...t,
			username:
				t.user?.displayName ||
				t.user?.username ||
				(t.user?.walletAddress
					? `${t.user.walletAddress.slice(0, 4)}...${t.user.walletAddress.slice(-4)}`
					: "Unknown"),
		}));
	}, []);

	// Base normalized trades from props
	const normalizedInitialTrades = useMemo(() => {
		return normalizeTrades(safeInitialTrades);
	}, [safeInitialTrades, normalizeTrades]);

	// WebSocket trades (new trades from real-time updates)
	const [wsTrades, setWsTrades] = useState<typeof normalizedInitialTrades>(
		[],
	);

	// Combine WebSocket trades with initial trades
	const trades = useMemo(() => {
		return [...wsTrades, ...normalizedInitialTrades].slice(0, 100);
	}, [wsTrades, normalizedInitialTrades]);

	useEffect(() => {
		const unsubscribe = wsService.subscribeToTrades(
			tokenId,
			(event: TradeEvent) => {
				// Calculate tokenAmount from totalValue/price if not provided
				const calculatedTokenAmount =
					event.totalValue &&
					event.price &&
					parseFloat(event.price) > 0
						? (
								parseFloat(event.totalValue) /
								parseFloat(event.price)
							).toString()
						: event.amount || "0";

				const newTrade = {
					id: event.tradeId,
					type: event.type,
					amount: event.amount,
					tokenAmount: calculatedTokenAmount,
					price: event.price,
					totalValue: event.totalValue,
					txHash: event.txHash,
					createdAt: event.timestamp || new Date().toISOString(),
					username: event.username,
					user: {
						walletAddress: event.userId,
						displayName: event.username,
						avatarUrl: event.userAvatar,
					},
				};
				// @ts-expect-error - adding calculated tokenAmount field
				setWsTrades((prev) => [newTrade, ...prev].slice(0, 50));
			},
		);

		return unsubscribe;
	}, [tokenId]);

	const isSolana = chainId ? isSolanaChain(chainId) : false;

	// Format amount — chain-aware for Solana vs EVM
	const formatAmount = (
		amount: string | undefined | null,
		isTokenAmount = false,
	) => {
		if (!amount) return "0";
		if (isSolana) {
			// Solana: native (SOL) = 9 decimals (lamports), tokens = 9 decimals
			const divisor = 1e9;
			const val = parseFloat(amount) / divisor;
			return formatNumber(val);
		}
		const val = fromWei(amount);
		return formatNumber(val);
	};

	// Format address for display
	const formatAddress = (address: string | undefined) => {
		if (!address) return "";
		return `${address.slice(0, 4)}...${address.slice(-4)}`;
	};

	// Filter trades by size
	const filteredTrades = trades.filter((trade) => {
		if (filter === "all") return true;
		const rawValue = trade.totalValue || trade.amount || "0";
		const amount = isSolana
			? parseFloat(rawValue) / 1e9
			: fromWei(rawValue);
		return amount >= parseFloat(filter);
	});

	return (
		<div className={cn("", className)}>
			{/* Header with Filter */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border gap-2">
				<div className="flex items-center gap-2 sm:gap-3 flex-wrap">
					<span className="text-xs sm:text-sm font-medium">
						Filter by size
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5 sm:gap-2 h-7 text-xs sm:text-sm"
							>
								<Filter className="h-3 w-3" />
								{filter === "all"
									? "All trades"
									: `≥ ${filter} ${nativeTokenSymbol}`}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => setFilter("all")}>
								All trades
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.05")}>
								≥ 0.05 {nativeTokenSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.1")}>
								≥ 0.1 {nativeTokenSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.5")}>
								≥ 0.5 {nativeTokenSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("1")}>
								≥ 1 {nativeTokenSymbol}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{filter !== "all" && (
						<span className="text-xs text-muted-foreground hidden sm:inline">
							Showing trades greater than {filter}{" "}
							{nativeTokenSymbol}
						</span>
					)}
				</div>
			</div>

			{/* Table Header */}
			<div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
				<div className="min-w-[600px]">
					<div className="grid grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr] gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs text-muted-foreground border-b border-border bg-muted/30">
						<span>Account</span>
						<span>Type</span>
						<span>{nativeTokenSymbol}</span>
						<span>{tokenSymbol}</span>
						<span>Time</span>
						<span>Txn</span>
					</div>
				</div>
			</div>

			{/* Table Body - native scrolling for both axes */}
			<div className="overflow-x-auto overflow-y-auto h-[400px] sm:h-[500px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
				<div className="divide-y divide-border/50 min-w-[600px]">
					<AnimatePresence mode="popLayout">
						{filteredTrades.length === 0 ? (
							<div className="text-center text-muted-foreground text-sm py-12">
								No trades yet. Be the first!
							</div>
						) : (
							filteredTrades.map((trade, index) => (
								<motion.div
									key={trade.id || index}
									initial={{ opacity: 0, y: -10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="grid grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr] gap-2 px-3 sm:px-4 py-2 sm:py-2.5 items-center hover:bg-muted/30 transition-colors"
								>
									{/* Account - Avatar + Username */}
									<div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
										<UserAvatar
											userId={
												trade.user?.id ||
												trade.userId ||
												trade.id
											}
											avatarUrl={trade.user?.avatarUrl}
											username={trade.username}
											sizeClassName="size-5 sm:size-6"
											className="shrink-0"
										/>
										<span className="text-xs sm:text-sm truncate">
											{trade.username || "Unknown"}
										</span>
									</div>

									{/* Type */}
									<div>
										<Badge
											variant="outline"
											className={cn(
												"text-xs font-medium",
												trade.type === "buy"
													? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30"
													: "bg-destructive/10 text-destructive border-destructive/30",
											)}
										>
											{trade.type === "buy"
												? "Buy"
												: "Sell"}
										</Badge>
									</div>

									{/* Amount (Native) */}
									<span className="text-xs sm:text-sm tabular-nums truncate">
										{formatAmount(
											trade.totalValue || trade.price,
											false, // native amount
										)}
									</span>

									{/* Amount (Token) */}
									<span
										className={cn(
											"text-xs sm:text-sm tabular-nums font-medium truncate",
											trade.type === "buy"
												? "text-[#00ff88]"
												: "text-destructive",
										)}
									>
										{formatAmount(
											// @ts-expect-error - tokenAmount field added dynamically
											trade.tokenAmount || trade.amount,
											true, // token amount
										)}
									</span>

									{/* Time */}
									<span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
										{trade.createdAt
											? (() => {
													const dist =
														formatDistanceToNow(
															new Date(
																trade.createdAt,
															),
															{
																addSuffix: false,
															},
														);
													// Shorten "less than a minute" → "<1m", "about X hours" → "Xh" etc.
													return dist
														.replace(
															/less than a minute/i,
															"<1m",
														)
														.replace(/about /i, "")
														.replace(
															/ minutes?/i,
															"m",
														)
														.replace(
															/ hours?/i,
															"h",
														)
														.replace(/ days?/i, "d")
														.replace(
															/ months?/i,
															"mo",
														)
														.replace(
															/ years?/i,
															"y",
														);
												})()
											: "now"}
									</span>

									{/* Txn Hash */}
									<div>
										{trade.txHash ? (
											<a
												href={getTxUrl(
													trade.txHash,
													chainId,
												)}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-primary hover:underline flex items-center gap-1"
											>
												{formatAddress(trade.txHash)}
												<ExternalLink className="h-3 w-3" />
											</a>
										) : (
											<span className="text-xs text-muted-foreground">
												—
											</span>
										)}
									</div>
								</motion.div>
							))
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
