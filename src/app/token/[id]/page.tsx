"use client";

import { use, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
	Globe,
	Twitter,
	Share2,
	Star,
	Copy,
	Check,
	TrendingUp,
	TrendingDown,
	MessageCircle,
	ExternalLink,
	Shield,
	Activity,
	Users,
	BarChart3,
	Clock,
	Info,
	ChevronDown,
	ChevronUp,
	Loader2,
	// RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChart } from "@/components/charts";
import {
	TradeTape,
	TradingPanel,
	OnChainTradingPanel,
} from "@/components/trade";
import { BondingCurveProgress, TokenChat, VestingCard } from "@/components/token";
import { useToken, tokenKeys, useTokenHolders } from "@/hooks/useTokens";
import { useTokenTrades, tradeKeys } from "@/hooks/useTrades";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useManualSync } from "@/hooks/useBlockchainSync";
import { usePersistedTabs } from "@/hooks/usePersistedTabs";
import {
	cn,
	formatMarketCap,
	formatVolume,
	formatPrice,
	fromWei,
} from "@/lib/utils";
import type { Address } from "viem";
import type { Token } from "@/types";

interface TokenDetailPageProps {
	params: Promise<{ id: string }>;
}

export default function TokenDetailPage({ params }: TokenDetailPageProps) {
	const { id } = use(params);
	const [copied, setCopied] = useState(false);
	const [showFullDescription, setShowFullDescription] = useState(false);
	const [isStarred, setIsStarred] = useState(false);

	const { data: token, isLoading, error } = useToken(id);
	const { data: tradesData } = useTokenTrades(id);

	// Ensure trades is always an array, even if data is undefined
	const trades = tradesData || [];

	console.log({ trades });
	const { data: holdersData, isLoading: holdersLoading } =
		useTokenHolders(id);
	const { sync: syncWithBlockchain, isSyncing } = useManualSync(id);
	const queryClient = useQueryClient();

	// Tab persistence with URL sync
	const { activeTab, setActiveTab } = usePersistedTabs({
		key: "tab",
		defaultTab: "trades" as const,
		validTabs: ["trades", "comments", "holders"] as const,
	});

	// Get holders from blockchain data
	const holders = holdersData?.holders || [];

	// Real-time updates via WebSocket
	const handleWebSocketMessage = useCallback(
		(message: any) => {
			if (
				message.channel === `trades:${id}` &&
				message.event === "trade_executed"
			) {
				// Invalidate trades query to refetch
				queryClient.invalidateQueries({
					queryKey: tradeKeys.byToken(id),
				});
				// Invalidate token detail to get updated stats
				queryClient.invalidateQueries({
					queryKey: tokenKeys.detail(id),
				});
				// Invalidate holders query to get updated count from blockchain
				queryClient.invalidateQueries({
					queryKey: tokenKeys.holders(id),
				});
			}
			if (
				message.channel === `price:${id}` &&
				message.event === "price_update"
			) {
				// Update token data optimistically with all stats including holdersCount and tradesCount
				queryClient.setQueryData(
					tokenKeys.detail(id),
					(oldData: Token | undefined) => {
						if (!oldData) return oldData;
						return {
							...oldData,
							currentPrice: message.data.price,
							marketCap: message.data.marketCap,
							priceChange24h:
								message.data.priceChange24h ??
								oldData.priceChange24h,
							// Update tradesCount in real-time
							tradesCount:
								message.data.tradesCount ?? oldData.tradesCount,
						};
					},
				);
			}
		},
		[id, queryClient],
	);

	const { isConnected, subscribe, unsubscribe } = useWebSocket({
		onMessage: handleWebSocketMessage,
	});

	// Subscribe to token-specific channels
	useEffect(() => {
		if (isConnected && id) {
			subscribe(`trades:${id}`);
			subscribe(`price:${id}`);

			return () => {
				unsubscribe(`trades:${id}`);
				unsubscribe(`price:${id}`);
			};
		}
	}, [isConnected, id, subscribe, unsubscribe]);

	// Format contract address for display
	const formatAddress = (address: string) => {
		if (!address) return "";
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	// Get explorer URL for contract
	const getExplorerUrl = (address: string) => {
		return `https://amoy.polygonscan.com/address/${address}`;
	};

	const handleCopy = () => {
		if (!token) return;
		navigator.clipboard.writeText(token.id);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleShare = async () => {
		if (!token) return;
		const url = window.location.href;
		const text = `Check out $${token.symbol} on HypeMint!`;

		if (navigator.share) {
			try {
				await navigator.share({ title: token.name, text, url });
			} catch (e) {
				// User cancelled or error
			}
		} else {
			navigator.clipboard.writeText(url);
		}
	};

	// Calculate time since creation
	const getTimeSinceCreation = () => {
		if (!token?.createdAt) return "";
		const created = new Date(token.createdAt);
		const now = new Date();
		const diffMs = now.getTime() - created.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) return `${diffDays}d ago`;
		if (diffHours > 0) return `${diffHours}h ago`;
		return "Just now";
	};

	if (isLoading) {
		return (
			<div className="w-full mx-auto p-6 overflow-x-hidden">
				<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] gap-6">
					<div className="min-w-0 space-y-6">
						<Skeleton className="h-[438.51px] rounded-xl" />
						<Skeleton className="h-[443.28px] rounded-xl" />
						<Skeleton className="h-[35.99px] rounded-xl" />
						<Skeleton className="h-[347.31px] rounded-xl" />
					</div>
					<div className="lg:sticky lg:top-4 lg:self-start space-y-6 lg:max-h-[calc(100vh-2rem)]">
						<Skeleton className="h-[322.26px] rounded-xl" />
						<Skeleton className="h-[98.14px] rounded-xl" />
						<Skeleton className="h-[188.32px] rounded-xl" />
						<Skeleton className="h-[142.14px] rounded-xl" />
					</div>
				</div>
			</div>
		);
	}

	if (error || !token) {
		return (
			<div className="w-full mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
				<h1 className="text-3xl font-bold mb-4">Token not found</h1>
				<p className="text-muted-foreground mb-6">
					The token you are looking for does not exist or has been
					removed.
				</p>
				<Link href="/">
					<Button>Return to Home</Button>
				</Link>
			</div>
		);
	}

	const pricePositive = (token.priceChange24h ?? 0) >= 0;

	return (
		<div className="w-full mx-auto p-3 sm:p-4 lg:p-6 relative overflow-x-clip">
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] relative gap-4 lg:gap-6">
				{/* Main Content */}
				<div className="min-w-0 space-y-4 sm:space-y-6">
					{/* Token Header */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-card border border-border rounded-xl p-4 sm:p-6"
					>
						<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
							<div className="flex items-center gap-3 sm:gap-4">
								<div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-muted overflow-hidden shrink-0">
									{token.imageUrl ? (
										<Image
											src={token.imageUrl.replace(
												"0.0.0.0",
												"localhost",
											)}
											alt={token.name || "Token"}
											width={48}
											height={48}
											unoptimized
											className="object-cover w-full h-full"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
											{token.symbol?.slice(0, 2) || "??"}
										</div>
									)}
								</div>

								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
										<h1 className="text-lg sm:text-xl font-bold truncate">
											{token.name}
										</h1>
										<Badge
											variant="outline"
											className="text-xs"
										>
											{token.symbol}
										</Badge>
										{token.status === "active" && (
											<Badge className="bg-primary/20 text-primary text-xs">
												Live
											</Badge>
										)}
									</div>
									<div className="flex items-center gap-2 mt-1">
										<span className="text-xs text-muted-foreground">
											Created by
										</span>
										<Link
											href={`/user/${token.creator?.walletAddress || ""}`}
											className="text-xs text-primary hover:underline"
										>
											{token.creator?.displayName ||
												token.creator?.username ||
												(token.creator?.walletAddress
													? `${token.creator.walletAddress.slice(0, 6)}...`
													: "Unknown")}
										</Link>
										<span className="text-xs text-muted-foreground">
											{token.createdAt
												? new Date(
														token.createdAt,
													).toLocaleDateString()
												: ""}
										</span>
										
										{/* hypebost badge */}
										{token.hypeBoostEnabled && (
											<Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs gap-1">
												<Shield className="h-3 w-3" />
												HypeBoost
											</Badge>
										)}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2 shrink-0">
								{/* <Button
									variant="outline"
									size="icon"
									className="h-8 w-8 sm:h-9 sm:w-9"
									onClick={() => syncWithBlockchain()}
									disabled={isSyncing}
									title="Sync with blockchain"
								>
									<RefreshCw
										className={cn(
											"h-3.5 w-3.5 sm:h-4 sm:w-4",
											isSyncing && "animate-spin",
										)}
									/>
								</Button> */}
								<Button
									variant="outline"
									size="icon"
									className="h-8 w-8 sm:h-9 sm:w-9"
									onClick={handleShare}
								>
									<Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									className={cn(
										"h-8 w-8 sm:h-9 sm:w-9",
										isStarred ? "text-yellow-500" : "",
									)}
									onClick={() => setIsStarred(!isStarred)}
								>
									<Star
										className={cn(
											"h-3.5 w-3.5 sm:h-4 sm:w-4",
											isStarred && "fill-current",
										)}
									/>
								</Button>
							</div>
						</div>

						{/* Token Badges */}
						<div className="flex flex-wrap items-center gap-2 mt-4">
							{token.hypeBoostEnabled && (
								<Badge className="bg-lienar-to-r from-purple-500 to-pink-500 text-white text-xs gap-1">
									<Shield className="h-3 w-3" />
									HypeBoost
								</Badge>
							)}
							<Badge variant="outline" className="text-xs gap-1">
								<Clock className="h-3 w-3" />
								{getTimeSinceCreation()}
							</Badge>
							{token.id && (
								<a
									href={getExplorerUrl(token.id)}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex"
								>
									<Badge
										variant="outline"
										className="text-xs gap-1 hover:bg-muted cursor-pointer"
									>
										<ExternalLink className="h-3 w-3" />
										{formatAddress(token.id)}
									</Badge>
								</a>
							)}
						</div>

						{/* Description */}
						{token.description && (
							<div className="mt-4">
								<p
									className={cn(
										"text-sm text-muted-foreground",
										!showFullDescription && "line-clamp-2",
									)}
								>
									{token.description}
								</p>
								{token.description.length > 150 && (
									<button
										onClick={() =>
											setShowFullDescription(
												!showFullDescription,
											)
										}
										className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
									>
										{showFullDescription ? (
											<>
												Show less{" "}
												<ChevronUp className="h-3 w-3" />
											</>
										) : (
											<>
												Show more{" "}
												<ChevronDown className="h-3 w-3" />
											</>
										)}
									</button>
								)}
							</div>
						)}

						{/* Price Stats */}
						<div className="mt-6">
							<div className="flex items-baseline gap-2">
								<span className="text-muted-foreground text-sm">
									Market Cap
								</span>
							</div>
							<div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mt-1">
								<span className="text-2xl sm:text-3xl font-bold">
									{formatMarketCap(token.marketCap)}
								</span>
								<span
									className={cn(
										"text-sm font-medium flex items-center gap-1",
										pricePositive
											? "text-[#00ff88]"
											: "text-destructive",
									)}
								>
									{pricePositive ? (
										<TrendingUp className="h-4 w-4" />
									) : (
										<TrendingDown className="h-4 w-4" />
									)}
									{pricePositive ? "+" : ""}
									{(token.priceChange24h ?? 0).toFixed(2)}%
									24hr
								</span>
							</div>
						</div>

						{/* Quick Stats */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
							<div>
								<p className="text-xs text-muted-foreground">
									Vol 24h
								</p>
								<p className="font-semibold tabular-nums">
									{formatVolume(token.volume24h)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Price
								</p>
								<p className="font-semibold tabular-nums">
									{formatPrice(token.currentPrice)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Holders
								</p>
								<p className="font-semibold tabular-nums">
									{holdersData?.totalHolders ?? 0}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Trades
								</p>
								<p className="font-semibold tabular-nums">
									{token.tradesCount ?? 0}
								</p>
							</div>
						</div>

						{/* Social Links */}
						<div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
							{token.websiteUrl && (
								<a
									href={token.websiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								>
									<Globe className="h-3.5 w-3.5" />
									Website
								</a>
							)}
							{token.twitterUrl && (
								<a
									href={token.twitterUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								>
									<Twitter className="h-3.5 w-3.5" />
									Twitter
								</a>
							)}
							{token.telegramUrl && (
								<a
									href={token.telegramUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								>
									<MessageCircle className="h-3.5 w-3.5" />
									Telegram
								</a>
							)}
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCopy}
								className="h-7 text-xs gap-1.5 rounded-full"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-green-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
								{copied ? "Copied!" : "Copy Address"}
							</Button>
						</div>
					</motion.div>

					{/* Price Chart */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<PriceChart tokenId={id} />
					</motion.div>

					{/* Comments / Trades / Holders Tabs */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						<Tabs
							value={activeTab}
							onValueChange={(value) =>
								setActiveTab(
									value as "trades" | "comments" | "holders",
								)
							}
						>
							<TabsList className="w-full bg-card border border-border">
								<TabsTrigger
									value="trades"
									className="flex-1 gap-1.5"
								>
									<BarChart3 className="h-3.5 w-3.5" />
									Trades
								</TabsTrigger>
								<TabsTrigger
									value="comments"
									className="flex-1 gap-1.5"
								>
									<MessageCircle className="h-3.5 w-3.5" />
									Comments
								</TabsTrigger>
								<TabsTrigger
									value="holders"
									className="flex-1 gap-1.5"
								>
									<Users className="h-3.5 w-3.5" />
									Holders{" "}
									{holdersData?.totalHolders
										? `(${holdersData.totalHolders})`
										: ""}
								</TabsTrigger>
							</TabsList>
							<TabsContent value="trades" className="mt-4">
								<TradeTape
									tokenId={id}
									initialTrades={trades}
								/>
							</TabsContent>
							<TabsContent value="comments" className="mt-4">
								<TokenChat
									tokenId={id}
									className="min-h-87.5"
								/>
							</TabsContent>
							<TabsContent value="holders" className="mt-4">
								<div className="bg-card border border-border rounded-xl p-6">
									{holdersLoading ? (
										<div className="text-center py-12">
											<Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
											<p className="text-muted-foreground">
												Loading holders from
												blockchain...
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												Scanning Transfer events
											</p>
										</div>
									) : holders.length > 0 ? (
										<div className="space-y-3">
											{holders.map((holder, index) => (
												<div
													key={holder.address}
													className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
												>
													<div className="flex items-center gap-3">
														<span
															className={cn(
																"w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
																index === 0
																	? "bg-yellow-500/20 text-yellow-500"
																	: index ===
																		  1
																		? "bg-gray-400/20 text-gray-400"
																		: index ===
																			  2
																			? "bg-orange-500/20 text-orange-500"
																			: "bg-muted text-muted-foreground",
															)}
														>
															{index + 1}
														</span>
														<div>
															<Link
																href={`/user/${holder.address}`}
																className="font-mono text-sm hover:text-primary"
															>
																{formatAddress(
																	holder.address,
																)}
															</Link>
															<p className="text-xs text-muted-foreground">
																{holder.balanceFormatted.toLocaleString(
																	undefined,
																	{
																		maximumFractionDigits: 2,
																	},
																)}{" "}
																tokens
															</p>
														</div>
													</div>
													<div className="text-right">
														<span className="font-semibold tabular-nums">
															{holder.percentage.toFixed(
																2,
															)}
															%
														</span>
														<div className="w-20 h-1.5 bg-muted rounded-full mt-1">
															<div
																className="h-full bg-primary rounded-full"
																style={{
																	width: `${Math.min(holder.percentage, 100)}%`,
																}}
															/>
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="text-center py-12">
											<Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
											<p className="text-muted-foreground">
												No holders data available yet
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												Holder data will appear after
												trading begins
											</p>
										</div>
									)}
								</div>
							</TabsContent>
						</Tabs>
					</motion.div>
				</div>

        {/* Sidebar */}
     <div className="min-w-0 w-full lg:sticky lg:top-22 lg:self-start space-y-4 sm:space-y-6 overflow-hidden lg:max-h-[calc(100vh-2rem)]">
          {/* Vesting Panel (Only if HypeBoost is enabled) */}
          {token.hypeBoostEnabled && token.bondingCurveAddress && (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-6"
            >
                <VestingCard 
                    bondingCurveAddress={token.bondingCurveAddress as Address} 
                    symbol={token.symbol} 
                />
            </motion.div>
          )}

          {/* Trading Panel - On-Chain or Centralized */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {token.bondingCurveAddress && token.contractAddress ? (
              <OnChainTradingPanel
                tokenAddress={token.contractAddress as Address}
                bondingCurveAddress={token.bondingCurveAddress as Address}
                tokenSymbol={token.symbol || "TOKEN"}
                tokenName={token.name || "Unknown Token"}
                currentPrice={token.currentPrice || "0.00001"}
              />
            ) : (
              <TradingPanel
                tokenId={id}
                tokenSymbol={token.symbol || "TOKEN"}
                tokenName={token.name || "Unknown Token"}
                currentPrice={token.currentPrice || "0.00001"}
                totalSupply={token.totalSupply || "1000000000"}
              />
            )}
          </motion.div>

					{/* Bonding Curve */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.1 }}
						className="bg-card border border-border rounded-xl p-4"
					>
						<BondingCurveProgress
							progress={token.bondingCurveProgress ?? 0}
							currentAmount={token.currentBondingAmount || "0"}
							targetAmount={token.graduationTarget || "100"}
						/>
					</motion.div>

					{/* Token Info */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.2 }}
						className="bg-card border border-border rounded-xl p-4"
					>
						<div className="flex items-center gap-2 mb-4">
							<Info className="h-4 w-4 text-muted-foreground" />
							<span className="font-semibold text-sm">
								Token Info
							</span>
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">
									Total Supply
								</span>
								<span className="text-sm font-mono tabular-nums">
									{parseFloat(
										token.totalSupply || "1000000000",
									).toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">
									Circulating
								</span>
								<span className="text-sm font-mono tabular-nums">
									{parseFloat(
										token.circulatingSupply || "0",
									).toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">
									Reserve
								</span>
								<span className="text-sm font-mono tabular-nums">
									{fromWei(
										token.currentBondingAmount || "0",
									).toFixed(4)}{" "}
									POL
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">
									Network
								</span>
								<Badge variant="outline" className="text-xs">
									Polygon Amoy
								</Badge>
							</div>
							{token.hypeBoostEnabled && (
								<>
									<div className="border-t border-border pt-3 mt-3">
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
											<Shield className="h-3.5 w-3.5 text-purple-500" />
											<span>HypeBoost Protection</span>
										</div>
										<div className="grid grid-cols-2 gap-2 text-xs">
											<div className="bg-muted/50 rounded-lg p-2">
												<p className="text-muted-foreground">
													Max Wallet
												</p>
												<p className="font-medium">
													2%
												</p>
											</div>
											<div className="bg-muted/50 rounded-lg p-2">
												<p className="text-muted-foreground">
													Snipe Protection
												</p>
												<p className="font-medium">
													5 blocks
												</p>
											</div>
										</div>
									</div>
								</>
							)}
						</div>
					</motion.div>

					{/* Quick Stats - Activity Section */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.3 }}
						className="bg-card border border-border rounded-xl p-4"
					>
						<div className="flex items-center gap-2 mb-4">
							<Activity className="h-4 w-4 text-muted-foreground" />
							<span className="font-semibold text-sm">
								Activity
							</span>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-muted/30 rounded-lg p-3 text-center">
								<p className="text-2xl font-bold tabular-nums">
									{holdersData?.totalHolders ?? 0}
								</p>
								<p className="text-xs text-muted-foreground">
									Holders
								</p>
							</div>
							<div className="bg-muted/30 rounded-lg p-3 text-center">
								<p className="text-2xl font-bold tabular-nums">
									{token.tradesCount ?? 0}
								</p>
								<p className="text-xs text-muted-foreground">
									Trades
								</p>
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
