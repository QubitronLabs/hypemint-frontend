"use client";

/**
 * Portfolio Component
 * Shows user's token holdings, P&L, and transaction history
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import {
	Wallet,
	TrendingUp,
	TrendingDown,
	ArrowUpRight,
	ArrowDownRight,
	Clock,
	ExternalLink,
	PieChart,
	BarChart3,
	Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatNumber, fromWei } from "@/lib/utils";
import {
	formatSafeValue,
	formatSafeBalance,
	formatRelativeTime,
	getNativeTokenSymbol,
	formatSafeTokenAmount,
	formatSafePrice,
} from "@/lib/formatters";
import { useAuth, useGlobalNetwork } from "@/hooks";
import { useUserTrades, tradeKeys } from "@/hooks/useTrades";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getAddressUrl } from "@/lib/wagmi";
import type { Trade } from "@/types";

interface PortfolioProps {
	className?: string;
}

interface HoldingDisplay {
	tokenId: string;
	tokenName: string;
	tokenSymbol: string;
	tokenImage?: string;
	balance: string;
	value: number;
	costBasis: number;
	pnl: number;
	pnlPercent: number;
	lastTrade?: Date;
}

export function Portfolio({ className }: PortfolioProps) {
	const { isAuthenticated, walletAddress } = useAuth();
	const [activeTab, setActiveTab] = useState("holdings");
	const queryClient = useQueryClient();

	// Get Dynamic context for native token info and balance
	const { primaryWallet } = useDynamicContext();
	const { networkName, chainLogo, chainId } = useGlobalNetwork();

	// State for native balance from Dynamic
	const [nativeBalance, setNativeBalance] = useState<string | null>(null);
	const [balanceLoading, setBalanceLoading] = useState(false);

	// Fetch native balance from Dynamic wallet
	useEffect(() => {
		const fetchBalance = async () => {
			if (!primaryWallet) {
				setNativeBalance(null);
				return;
			}

			setBalanceLoading(true);
			try {
				// Dynamic.xyz provides getBalance method on wallet
				const balance = await primaryWallet.getBalance();
				console.log(
					"[Portfolio] Native balance from Dynamic:",
					balance,
				);
				setNativeBalance(balance || "0");
			} catch (error) {
				console.error("[Portfolio] Failed to fetch balance:", error);
				setNativeBalance("0");
			} finally {
				setBalanceLoading(false);
			}
		};

		fetchBalance();
	}, [primaryWallet, chainId]); // Re-fetch when chain changes

	// Get native token symbol from network name (uses our formatter helper)
	const nativeTokenSymbol = useMemo(() => {
		// First check network name from our global network store
		if (networkName) {
			return getNativeTokenSymbol(networkName);
		}
		// Fallback to wallet chain
		if (primaryWallet?.chain) {
			return getNativeTokenSymbol(primaryWallet.chain);
		}
		return "ETH";
	}, [networkName, primaryWallet?.chain]);

	// Fetch user's trades
	const {
		data: userTrades,
		isLoading: tradesLoading,
		refetch: refetchTrades,
	} = useUserTrades();

	// Real-time updates via WebSocket
	const handleWebSocketMessage = useCallback(
		(message: unknown) => {
			const msg = message as { channel?: string; event?: string };
			if (
				msg.channel === "global:trades" &&
				msg.event === "trade_executed"
			) {
				// Refetch user trades when any trade happens (to update portfolio)
				refetchTrades();
			}
			if (
				msg.channel === "global:tokens" &&
				msg.event === "token_updated"
			) {
				// Invalidate user trades to get updated token prices
				queryClient.invalidateQueries({ queryKey: tradeKeys.user() });
			}
		},
		[queryClient, refetchTrades],
	);

	const {
		isConnected: wsConnected,
		subscribe,
		unsubscribe,
	} = useWebSocket({
		onMessage: handleWebSocketMessage,
	});

	// Subscribe to global trade channel for portfolio updates
	useEffect(() => {
		if (wsConnected) {
			subscribe("global:trades");
			subscribe("global:tokens");

			return () => {
				unsubscribe("global:trades");
				unsubscribe("global:tokens");
			};
		}
	}, [wsConnected, subscribe, unsubscribe]);

	// Calculate holdings from trades (simplified - in production, use on-chain balances)
	const holdings = useMemo((): HoldingDisplay[] => {
		if (!userTrades || !Array.isArray(userTrades)) return [];

		// Group trades by token
		const tokenMap = new Map<
			string,
			{
				buys: number;
				sells: number;
				buyValue: number;
				sellValue: number;
				token: Trade["token"];
				lastTrade: Date;
			}
		>();

		userTrades.forEach((trade) => {
			if (!trade.token) return;

			const existing = tokenMap.get(trade.tokenId) || {
				buys: 0,
				sells: 0,
				buyValue: 0,
				sellValue: 0,
				token: trade.token,
				lastTrade: new Date(trade.createdAt),
			};

			const amount = fromWei(trade.amount);
			const value = fromWei(trade.totalValue);

			if (trade.type === "buy") {
				existing.buys += amount;
				existing.buyValue += value;
			} else {
				existing.sells += amount;
				existing.sellValue += value;
			}

			if (new Date(trade.createdAt) > existing.lastTrade) {
				existing.lastTrade = new Date(trade.createdAt);
			}

			tokenMap.set(trade.tokenId, existing);
		});

		// Convert to holdings array
		const holdings = Array.from(tokenMap.entries())
			.map(([tokenId, data]) => {
				const balance = data.buys - data.sells;
				if (balance <= 0) return null;

				const currentPrice = parseFloat(
					data.token?.currentPrice || "0",
				);
				const currentValue = balance * currentPrice;
				const costBasis = data.buyValue - data.sellValue;
				const pnl = currentValue - costBasis;
				const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

				return {
					tokenId,
					tokenName: data.token?.name || "Unknown",
					tokenSymbol: data.token?.symbol || "???",
					tokenImage: data.token?.imageUrl,
					balance: formatNumber(balance),
					value: currentValue,
					costBasis,
					pnl,
					pnlPercent,
					lastTrade: data.lastTrade,
				} as HoldingDisplay;
			})
			.filter((h): h is HoldingDisplay => h !== null)
			.sort((a, b) => b.value - a.value);

		return holdings;
	}, [userTrades]);

	// Calculate portfolio totals
	const portfolioStats = useMemo(() => {
		const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
		const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
		const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
		const totalPnlPercent =
			totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

		// Parse native balance from Dynamic (comes as string like "1.234")
		const nativeValue = nativeBalance ? parseFloat(nativeBalance) : 0;

		return {
			totalValue,
			totalCost,
			totalPnl,
			totalPnlPercent,
			nativeValue: Number.isFinite(nativeValue) ? nativeValue : 0,
			totalPortfolioValue:
				totalValue + (Number.isFinite(nativeValue) ? nativeValue : 0),
		};
	}, [holdings, nativeBalance]);

	// Not connected state
	if (!isAuthenticated) {
		return (
			<div
				className={cn(
					"bg-card border border-border rounded-xl p-12 text-center",
					className,
				)}
			>
				<Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
				<h3 className="text-xl font-semibold mb-2">
					Connect Your Wallet
				</h3>
				<p className="text-muted-foreground mb-6 max-w-md mx-auto">
					Connect your wallet to view your portfolio, holdings, and
					transaction history
				</p>
			</div>
		);
	}

	// Loading state
	if (balanceLoading || tradesLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}
				</div>
				<Skeleton className="h-[400px] rounded-xl" />
			</div>
		);
	}

	return (
		<TooltipProvider>
			<div className={cn("space-y-6", className)}>
				{/* Portfolio Overview */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
					{/* Total Value Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-card border border-border rounded-xl p-3 md:p-4 min-w-0"
					>
						<div className="flex items-center gap-2 mb-2">
							<div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
								<PieChart className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
							</div>
							<span className="text-xs md:text-sm text-muted-foreground truncate">
								Total Value
							</span>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<p className="text-lg md:text-2xl font-bold truncate cursor-help">
									{
										formatSafeValue(
											portfolioStats.totalPortfolioValue,
										).display
									}
								</p>
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-mono text-xs">
									{
										formatSafeValue(
											portfolioStats.totalPortfolioValue,
										).full
									}
								</p>
							</TooltipContent>
						</Tooltip>
					</motion.div>

					{/* Token Holdings Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						className="bg-card border border-border rounded-xl p-3 md:p-4 min-w-0"
					>
						<div className="flex items-center gap-2 mb-2">
							<div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
								<Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-500" />
							</div>
							<span className="text-xs md:text-sm text-muted-foreground truncate">
								Token Holdings
							</span>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<p className="text-lg md:text-2xl font-bold truncate cursor-help">
									{
										formatSafeValue(
											portfolioStats.totalValue,
										).display
									}
								</p>
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-mono text-xs">
									{
										formatSafeValue(
											portfolioStats.totalValue,
										).full
									}
								</p>
							</TooltipContent>
						</Tooltip>
					</motion.div>

					{/* Total P&L Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						className="bg-card border border-border rounded-xl p-3 md:p-4 min-w-0"
					>
						<div className="flex items-center gap-2 mb-2">
							<div
								className={cn(
									"w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0",
									portfolioStats.totalPnl >= 0
										? "bg-green-500/20"
										: "bg-red-500/20",
								)}
							>
								{portfolioStats.totalPnl >= 0 ? (
									<TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
								) : (
									<TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
								)}
							</div>
							<span className="text-xs md:text-sm text-muted-foreground truncate">
								Total P&L
							</span>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<p
									className={cn(
										"text-lg md:text-2xl font-bold truncate cursor-help",
										portfolioStats.totalPnl >= 0
											? "text-green-500"
											: "text-red-500",
									)}
								>
									{portfolioStats.totalPnl >= 0 ? "+" : ""}
									{
										formatSafeValue(portfolioStats.totalPnl)
											.display
									}
								</p>
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-mono text-xs">
									{
										formatSafeValue(portfolioStats.totalPnl)
											.full
									}
								</p>
							</TooltipContent>
						</Tooltip>
						<p
							className={cn(
								"text-xs truncate",
								portfolioStats.totalPnl >= 0
									? "text-green-500"
									: "text-red-500",
							)}
						>
							{portfolioStats.totalPnlPercent >= 0 ? "+" : ""}
							{Number.isFinite(portfolioStats.totalPnlPercent)
								? portfolioStats.totalPnlPercent.toFixed(2)
								: "0.00"}
							%
						</p>
					</motion.div>

					{/* Native Token Balance Card - Dynamic based on network */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
						className="bg-card border border-border rounded-xl p-3 md:p-4 min-w-0"
					>
						<div className="flex items-center gap-2 mb-2">
							<div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
								{chainLogo ? (
									<Image
										src={chainLogo}
										alt={nativeTokenSymbol}
										width={16}
										height={16}
										className="w-4 h-4 md:w-5 md:h-5 object-contain"
									/>
								) : (
									<Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-500" />
								)}
							</div>
							<span className="text-xs md:text-sm text-muted-foreground truncate">
								{nativeTokenSymbol} Balance
							</span>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<p className="text-lg md:text-2xl font-bold truncate cursor-help">
									{
										formatSafeBalance(
											portfolioStats.nativeValue,
											nativeTokenSymbol,
										).display
									}
								</p>
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-mono text-xs">
									{
										formatSafeBalance(
											portfolioStats.nativeValue,
											nativeTokenSymbol,
										).full
									}
								</p>
							</TooltipContent>
						</Tooltip>
					</motion.div>
				</div>

				{/* Main Content */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<div className="flex items-center justify-between mb-4">
							<TabsList className="bg-card border border-border">
								<TabsTrigger value="holdings" className="gap-2">
									<Coins className="h-4 w-4" />
									Holdings
								</TabsTrigger>
								<TabsTrigger value="history" className="gap-2">
									<Clock className="h-4 w-4" />
									History
								</TabsTrigger>
							</TabsList>

							{walletAddress && (
								<a
									href={getAddressUrl(walletAddress)}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
								>
									View on Explorer
									<ExternalLink className="h-3 w-3" />
								</a>
							)}
						</div>

						{/* Holdings Tab */}
						<TabsContent value="holdings" className="space-y-4">
							{holdings.length === 0 ? (
								<div className="bg-card border border-border rounded-xl p-12 text-center">
									<Coins className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
									<h3 className="text-xl font-semibold mb-2">
										No Holdings Yet
									</h3>
									<p className="text-muted-foreground mb-6 max-w-md mx-auto">
										Start trading to build your portfolio!
									</p>
									<Link href="/">
										<Button className="gap-2">
											<BarChart3 className="h-4 w-4" />
											Explore Tokens
										</Button>
									</Link>
								</div>
							) : (
								<div className="bg-card border border-border rounded-xl overflow-hidden">
									{/* Table Header */}
									<div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 border-b border-border text-sm text-muted-foreground">
										<span>Token</span>
										<span className="text-right">
											Balance
										</span>
										<span className="text-right">
											Value
										</span>
										<span className="text-right">P&L</span>
										<span className="text-right">
											Last Trade
										</span>
									</div>

									{/* Holdings Rows */}
									{holdings.map((holding) => (
										<Link
											key={holding.tokenId}
											href={`/token/${holding.tokenId}`}
											className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 items-center border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
										>
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
													{holding.tokenImage ? (
														<Image
															src={
																holding.tokenImage
															}
															alt={
																holding.tokenName
															}
															width={40}
															height={40}
															className="object-cover w-full h-full"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center text-sm font-bold">
															{holding.tokenSymbol.slice(
																0,
																2,
															)}
														</div>
													)}
												</div>
												<div className="min-w-0">
													<p className="font-medium truncate">
														{holding.tokenName}
													</p>
													<p className="text-xs text-muted-foreground truncate">
														${holding.tokenSymbol}
													</p>
												</div>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<p className="font-medium tabular-nums truncate cursor-help">
															{
																formatSafeTokenAmount(
																	holding.balance,
																).display
															}
														</p>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafeTokenAmount(
																	holding.balance,
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<p className="font-medium tabular-nums truncate cursor-help">
															{
																formatSafeValue(
																	holding.value,
																).display
															}
														</p>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafeValue(
																	holding.value,
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="cursor-help">
															<p
																className={cn(
																	"font-medium tabular-nums truncate",
																	holding.pnl >=
																		0
																		? "text-green-500"
																		: "text-red-500",
																)}
															>
																{holding.pnl >=
																0
																	? "+"
																	: ""}
																{
																	formatSafeValue(
																		holding.pnl,
																	).display
																}
															</p>
															<p
																className={cn(
																	"text-xs",
																	holding.pnl >=
																		0
																		? "text-green-500"
																		: "text-red-500",
																)}
															>
																{holding.pnlPercent >=
																0
																	? "+"
																	: ""}
																{Number.isFinite(
																	holding.pnlPercent,
																)
																	? holding.pnlPercent.toFixed(
																			2,
																		)
																	: "0.00"}
																%
															</p>
														</div>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafeValue(
																	holding.pnl,
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right text-sm text-muted-foreground">
												{holding.lastTrade
													? formatRelativeTime(
															holding.lastTrade,
														)
													: "-"}
											</div>
										</Link>
									))}
								</div>
							)}
						</TabsContent>

						{/* History Tab */}
						<TabsContent value="history" className="space-y-4">
							{!userTrades || userTrades.length === 0 ? (
								<div className="bg-card border border-border rounded-xl p-12 text-center">
									<Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
									<h3 className="text-xl font-semibold mb-2">
										No Transactions Yet
									</h3>
									<p className="text-muted-foreground mb-6">
										Your trading history will appear here
									</p>
								</div>
							) : (
								<div className="bg-card border border-border rounded-xl overflow-hidden">
									{/* Table Header */}
									<div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-border text-sm text-muted-foreground">
										<span>Type</span>
										<span>Token</span>
										<span className="text-right">
											Amount
										</span>
										<span className="text-right">
											Price
										</span>
										<span className="text-right">
											Value
										</span>
										<span className="text-right">Time</span>
									</div>

									{/* Transaction Rows */}
									{userTrades.slice(0, 50).map((trade) => (
										<div
											key={trade.id}
											className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 items-center border-b border-border last:border-0"
										>
											<div
												className={cn(
													"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
													trade.type === "buy"
														? "bg-green-500/20"
														: "bg-red-500/20",
												)}
											>
												{trade.type === "buy" ? (
													<ArrowUpRight className="h-4 w-4 text-green-500" />
												) : (
													<ArrowDownRight className="h-4 w-4 text-red-500" />
												)}
											</div>

											<div className="flex items-center gap-3 min-w-0">
												<div className="w-8 h-8 rounded-lg bg-muted overflow-hidden flex-shrink-0">
													{trade.token?.imageUrl ? (
														<Image
															src={
																trade.token
																	.imageUrl
															}
															alt={
																trade.token
																	.name || ""
															}
															width={32}
															height={32}
															className="object-cover w-full h-full"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center text-xs font-bold">
															{trade.token?.symbol?.slice(
																0,
																2,
															) || "??"}
														</div>
													)}
												</div>
												<div className="min-w-0">
													<p className="font-medium text-sm truncate">
														{trade.token?.name ||
															"Unknown"}
													</p>
													<p className="text-xs text-muted-foreground truncate">
														$
														{trade.token?.symbol ||
															"???"}
													</p>
												</div>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<p
															className={cn(
																"font-medium tabular-nums text-sm truncate cursor-help",
																trade.type ===
																	"buy"
																	? "text-green-500"
																	: "text-red-500",
															)}
														>
															{trade.type ===
															"buy"
																? "+"
																: "-"}
															{
																formatSafeTokenAmount(
																	fromWei(
																		trade.amount,
																	),
																).display
															}
														</p>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafeTokenAmount(
																	fromWei(
																		trade.amount,
																	),
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<p className="font-medium tabular-nums text-sm truncate cursor-help">
															{
																formatSafePrice(
																	fromWei(
																		trade.price,
																	),
																).display
															}
														</p>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafePrice(
																	fromWei(
																		trade.price,
																	),
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right min-w-0">
												<Tooltip>
													<TooltipTrigger asChild>
														<p className="font-medium tabular-nums text-sm truncate cursor-help">
															{
																formatSafeValue(
																	fromWei(
																		trade.totalValue,
																	),
																).display
															}
														</p>
													</TooltipTrigger>
													<TooltipContent>
														<p className="font-mono text-xs">
															{
																formatSafeValue(
																	fromWei(
																		trade.totalValue,
																	),
																).full
															}
														</p>
													</TooltipContent>
												</Tooltip>
											</div>

											<div className="text-right text-xs text-muted-foreground min-w-[80px]">
												{formatRelativeTime(
													new Date(trade.createdAt),
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</TabsContent>
					</Tabs>
				</motion.div>
			</div>
		</TooltipProvider>
	);
}
