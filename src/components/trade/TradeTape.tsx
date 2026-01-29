"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useNativeCurrencySymbol } from "@/hooks";
import type { Trade, TradeEvent } from "@/types";

interface TradeTapeProps {
	tokenId: string;
	tokenSymbol?: string;
	initialTrades?: Trade[];
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
	tokenSymbol = "TOKEN",
	initialTrades = [],
	className,
}: TradeTapeProps) {
	const nativeSymbol = useNativeCurrencySymbol();
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
	const scrollRef = useRef<HTMLDivElement>(null);

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

	// Format amount
	const formatAmount = (amount: string | undefined | null) => {
		if (!amount) return "0";
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
		const amount = fromWei(trade.totalValue || trade.amount || "0");
		return amount >= parseFloat(filter);
	});

	return (
		<div className={cn("", className)}>
			{/* Header with Filter */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border">
				<div className="flex items-center gap-3">
					<span className="text-sm font-medium">Filter by size</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-2 h-7"
							>
								<Filter className="h-3 w-3" />
								{filter === "all"
									? "All trades"
									: `≥ ${filter} ${nativeSymbol}`}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => setFilter("all")}>
								All trades
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.05")}>
								≥ 0.05 {nativeSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.1")}>
								≥ 0.1 {nativeSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("0.5")}>
								≥ 0.5 {nativeSymbol}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("1")}>
								≥ 1 {nativeSymbol}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{filter !== "all" && (
						<span className="text-xs text-muted-foreground">
							Showing trades greater than {filter} {nativeSymbol}
						</span>
					)}
				</div>
			</div>

			{/* Table Header */}
			<div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">
				<span>Account</span>
				<span>Type</span>
				<span>{nativeSymbol}</span>
				<span>{tokenSymbol}</span>
				<span>Time</span>
				<span>Txn</span>
			</div>

			{/* Table Body */}
			<ScrollArea ref={scrollRef} className="h-[500px]">
				<div className="divide-y divide-border/50">
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
									className="grid grid-cols-6 gap-2 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors"
								>
									{/* Account - Avatar + Username */}
									<div className="flex items-center gap-2 min-w-0">
										<Avatar className="w-6 h-6 shrink-0">
											<AvatarImage
												src={
													trade.user?.avatarUrl ||
													undefined
												}
											/>
											<AvatarFallback className="bg-muted text-[10px]">
												{(trade.username || "U")
													.slice(0, 3)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="text-sm truncate">
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
									<span className="text-sm tabular-nums">
										{formatAmount(
											trade.totalValue || trade.price,
										)}
									</span>

									{/* Amount (Token) */}
									<span
										className={cn(
											"text-sm tabular-nums font-medium",
											trade.type === "buy"
												? "text-[#00ff88]"
												: "text-destructive",
										)}
									>
										{formatAmount(
											// @ts-expect-error - tokenAmount field added dynamically
											trade.tokenAmount || trade.amount,
										)}
									</span>

									{/* Time */}
									<span className="text-xs text-muted-foreground">
										{trade.createdAt
											? formatDistanceToNow(
													new Date(trade.createdAt),
													{
														addSuffix: false,
													},
												)
											: "now"}
									</span>

									{/* Txn Hash */}
									<div>
										{trade.txHash ? (
											<a
												href={`https://amoy.polygonscan.com/tx/${trade.txHash}`}
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
			</ScrollArea>
		</div>
	);
}
