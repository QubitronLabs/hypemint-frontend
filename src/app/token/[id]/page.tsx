"use client";

import { use, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
	Star,
	Copy,
	Check,
	Shield,
	Info,
	UserPlus,
	UserMinus,
	Loader2,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedPriceChart } from "@/components/charts";
import {
	BondingCurveProgress,
	TokenChat,
	VestingCard,
	BubbleMapDialog,
} from "@/components/token";
import {
	TradeTape,
	OnChainTradingPanel,
	TradingPanel,
} from "@/components/trade";

import { useToken, tokenKeys, useTokenHolders } from "@/hooks/useTokens";
import { useTokenTrades, tradeKeys } from "@/hooks/useTrades";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useManualSync } from "@/hooks/useBlockchainSync";
import { usePersistedTabs } from "@/hooks/usePersistedTabs";
import { useNativeCurrencySymbol, useAuth } from "@/hooks";
import {
	useFollowUser,
	useUnfollowUser,
	useUserProfile,
} from "@/hooks/useUsers";
import { useShare } from "@/lib/utils/share";
import { toast } from "sonner";
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
	const [isStarred, setIsStarred] = useState(false);
	const [localIsFollowing, setLocalIsFollowing] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
	const [showBubbleMap, setShowBubbleMap] = useState(false);
	const nativeSymbol = useNativeCurrencySymbol();

	// Auth and follow hooks
	const { isAuthenticated, walletAddress } = useAuth();
	const followMutation = useFollowUser();
	const unfollowMutation = useUnfollowUser();

	const { data: token, isLoading, error } = useToken(id);
	const { data: tradesData } = useTokenTrades(id);

	// Ensure trades is always an array, even if data is undefined
	const trades = tradesData || [];

	const { data: holdersData, isLoading: holdersLoading } =
		useTokenHolders(id);
	useManualSync(id);
	const queryClient = useQueryClient();

	// Tab persistence with URL sync - now only comments and trades
	const { activeTab, setActiveTab } = usePersistedTabs({
		key: "tab",
		defaultTab: "comments" as const,
		validTabs: ["comments", "trades"] as const,
	});

	// Get holders from blockchain data
	const holders = holdersData?.holders || [];

	// Fetch creator profile to check if current user is following them
	const creatorAddress = token?.creator?.walletAddress;
	const { data: creatorProfile } = useUserProfile(creatorAddress || "");

	// Check if current user is the creator
	const isOwnToken =
		walletAddress?.toLowerCase() === creatorAddress?.toLowerCase();

	// Sync local follow state with API data
	useEffect(() => {
		if (creatorProfile?.isFollowing !== undefined) {
			setLocalIsFollowing(creatorProfile.isFollowing);
		}
	}, [creatorProfile?.isFollowing]);

	// Follow/unfollow handler
	const handleFollow = async () => {
		if (!isAuthenticated || !creatorAddress) return;

		// Extra check: Don't allow following yourself
		if (isOwnToken) {
			toast.error("Cannot follow yourself");
			return;
		}

		// Store previous state for potential revert
		const wasFollowing = localIsFollowing;

		// Immediately update local state for instant UI feedback
		setLocalIsFollowing(!localIsFollowing);

		try {
			if (wasFollowing) {
				const response =
					await unfollowMutation.mutateAsync(creatorAddress);
				const creatorName =
					response?.user?.displayName ||
					response?.user?.username ||
					token?.creator?.displayName ||
					token?.creator?.username ||
					"this creator";
				toast.success("Unfollowed", {
					description: `You are no longer following ${creatorName}`,
				});
			} else {
				const response =
					await followMutation.mutateAsync(creatorAddress);
				const creatorName =
					response?.user?.displayName ||
					response?.user?.username ||
					token?.creator?.displayName ||
					token?.creator?.username ||
					"this creator";
				toast.success("Following!", {
					description: `You are now following ${creatorName}`,
				});
			}
		} catch (error: any) {
			// Revert on error
			setLocalIsFollowing(wasFollowing);

			// Extract error message from Axios API response
			// Structure: error.response.data.error.message for our API
			const apiErrorMessage = error?.response?.data?.error?.message;
			const fallbackMessage = wasFollowing
				? "Failed to unfollow"
				: "Failed to follow";
			const errorMessage =
				apiErrorMessage || error?.message || fallbackMessage;

			toast.error(errorMessage);
			console.error("Follow/unfollow failed:", error);
		}
	};

	const isFollowLoading =
		followMutation.isPending || unfollowMutation.isPending;

	// Share hook with customizable platforms
	const { open: openShare, ShareMenu: ShareMenuComponent } = useShare({
		title: token?.name || "Token",
		description: `Check out ${token?.symbol || ""} on HypeMint!`,
		hashtags: ["HypeMint", "Crypto", token?.symbol || ""].filter(Boolean),
		platforms: ["twitter", "telegram", "whatsapp", "reddit"],
	});

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
							priceChange5m:
								message.data.priceChange5m ??
								oldData.priceChange5m,
							priceChange1h:
								message.data.priceChange1h ??
								oldData.priceChange1h,
							priceChange6h:
								message.data.priceChange6h ??
								oldData.priceChange6h,
							bondingCurveProgress:
								message.data.bondingCurveProgress ??
								oldData.bondingCurveProgress,
							currentBondingAmount:
								message.data.currentBondingAmount ??
								oldData.currentBondingAmount,
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

	const handleCopy = () => {
		if (!token) return;
		navigator.clipboard.writeText(token.id);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
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
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] relative gap-4 lg:gap-6">
				{/* Main Content */}
				<div className="min-w-0 space-y-4 sm:space-y-6">
					{/* Section 1: Token Header Card - Simplified as per screenshot 1 */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-card border border-border rounded-xl p-4"
					>
						<div className="flex items-center justify-between gap-4">
							{/* Left side: Image, Name, Symbol, Creator, Time */}
							<div className="flex items-center gap-3 min-w-0">
								<div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
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
										<div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
											{token.symbol?.slice(0, 2) || "??"}
										</div>
									)}
								</div>

								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<h1 className="text-lg font-bold truncate">
											{token.name}
										</h1>
										<span className="text-sm text-muted-foreground">
											{token.symbol}
										</span>
									</div>
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Link
											href={`/user/${token.creator?.walletAddress || ""}`}
											className="hover:text-primary flex items-center gap-1"
										>
											<div className="w-4 h-4 rounded-full bg-muted overflow-hidden">
												{token.creator?.avatarUrl ? (
													<Image
														src={
															token.creator
																.avatarUrl
														}
														alt=""
														width={16}
														height={16}
														className="object-cover"
													/>
												) : null}
											</div>
											{token.creator?.displayName ||
												token.creator?.username ||
												(token.creator?.walletAddress
													? `${token.creator.walletAddress.slice(0, 6)}...`
													: "Unknown")}
										</Link>
										<span>·</span>
										<span>{getTimeSinceCreation()}</span>
									</div>
								</div>
							</div>

							{/* Right side: Follow, Share, Copy, Star buttons */}
							<div className="flex items-center gap-2 shrink-0">
								{/* Follow Button - only show if not own token and authenticated */}
								{!isOwnToken &&
									isAuthenticated &&
									creatorAddress && (
										<motion.button
											onClick={handleFollow}
											disabled={isFollowLoading}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
											className={cn(
												"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
												localIsFollowing
													? "border border-border text-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10"
													: "bg-primary text-primary-foreground hover:bg-primary/90",
												isFollowLoading &&
													"opacity-70 cursor-not-allowed",
											)}
										>
											{isFollowLoading ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : localIsFollowing ? (
												<>
													<UserMinus className="h-3.5 w-3.5" />
													<span className="hidden sm:inline">
														Unfollow
													</span>
												</>
											) : (
												<>
													<UserPlus className="h-3.5 w-3.5" />
													<span className="hidden sm:inline">
														Follow
													</span>
												</>
											)}
										</motion.button>
									)}
								<Button
									onClick={() => openShare()}
									size="sm"
									className="bg-primary hover:bg-primary/90 text-primary-foreground"
								>
									Share
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleCopy}
									className="gap-1.5"
								>
									{copied ? (
										<Check className="h-3.5 w-3.5 text-green-500" />
									) : (
										<Copy className="h-3.5 w-3.5" />
									)}
									{formatAddress(token.id)}
								</Button>
								<Button
									variant="outline"
									size="icon"
									className={cn(
										"h-8 w-8",
										isStarred ? "text-yellow-500" : "",
									)}
									onClick={() => setIsStarred(!isStarred)}
								>
									<Star
										className={cn(
											"h-4 w-4",
											isStarred && "fill-current",
										)}
									/>
								</Button>
							</div>
						</div>
					</motion.div>

					{/* Section 2: Price Chart with Market Cap Header - as per screenshot 2 */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						className="bg-card border border-border rounded-xl overflow-hidden"
					>
						{/* Market Cap Header */}
						<div className="p-4 border-b border-border">
							<div className="flex items-start justify-between">
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Market Cap
									</p>
									<p className="text-2xl sm:text-3xl font-bold">
										{formatMarketCap(token.marketCap)}
									</p>
									<p
										className={cn(
											"text-sm flex items-center gap-1 mt-1",
											pricePositive
												? "text-[#00ff88]"
												: "text-destructive",
										)}
									>
										{pricePositive ? "+" : ""}
										{(token.priceChange24h ?? 0).toFixed(2)}
										% 24hr
									</p>
								</div>
								{/* <div className="text-right">
									<p className="text-xs text-muted-foreground">
										ATH
									</p>
									<p className="text-sm font-medium text-primary">
										{formatMarketCap(
											token.athMarketCap ||
												token.marketCap,
										)}
									</p>
								</div> */}
							</div>
						</div>

						{/* Advanced Price Chart with Tools and Indicators */}
						<div className="h-[420px] sm:h-[480px]">
							<AdvancedPriceChart
								tokenId={id}
								className="border-none rounded-none h-full"
								showToolbar={true}
							/>
						</div>
					</motion.div>

					{/* Section 3: Metrics Row - 5 cards as per screenshot 2 bottom */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
						className="grid grid-cols-2 sm:grid-cols-5 gap-2"
					>
						<div className="bg-card border border-border rounded-lg p-3 text-center">
							<p className="text-xs text-muted-foreground mb-1">
								Vol 24h
							</p>
							<p className="font-semibold tabular-nums">
								{formatVolume(token.volume24h)}
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-3 text-center">
							<p className="text-xs text-muted-foreground mb-1">
								Price
							</p>
							<p className="font-semibold tabular-nums">
								{formatPrice(token.currentPrice)}
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-3 text-center">
							<p className="text-xs text-muted-foreground mb-1">
								5m
							</p>
							<p
								className={cn(
									"font-semibold tabular-nums",
									parseFloat(token.priceChange5m || "0") >= 0
										? "text-[#00ff88]"
										: "text-destructive",
								)}
							>
								{parseFloat(token.priceChange5m || "0") >= 0
									? "+"
									: ""}
								{parseFloat(token.priceChange5m || "0").toFixed(
									2,
								)}
								%
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-3 text-center">
							<p className="text-xs text-muted-foreground mb-1">
								1h
							</p>
							<p
								className={cn(
									"font-semibold tabular-nums",
									parseFloat(token.priceChange1h || "0") >= 0
										? "text-[#00ff88]"
										: "text-destructive",
								)}
							>
								{parseFloat(token.priceChange1h || "0") >= 0
									? "+"
									: ""}
								{parseFloat(token.priceChange1h || "0").toFixed(
									2,
								)}
								%
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-3 text-center col-span-2 sm:col-span-1">
							<p className="text-xs text-muted-foreground mb-1">
								6h
							</p>
							<p
								className={cn(
									"font-semibold tabular-nums",
									parseFloat(token.priceChange6h || "0") >= 0
										? "text-[#00ff88]"
										: "text-destructive",
								)}
							>
								{parseFloat(token.priceChange6h || "0") >= 0
									? "+"
									: ""}
								{parseFloat(token.priceChange6h || "0").toFixed(
									2,
								)}
								%
							</p>
						</div>
					</motion.div>

					{/* Section 3.5: Token Description */}
					{token.description && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.18 }}
							className="bg-card border border-border rounded-xl p-4"
						>
							<h3 className="text-sm font-semibold mb-2">
								About {token.symbol}
							</h3>
							<div className="relative">
								<p
									className={cn(
										"text-sm text-muted-foreground whitespace-pre-wrap",
										!isDescriptionExpanded &&
											"line-clamp-2",
									)}
								>
									{token.description}
								</p>
								{token.description.length > 150 && (
									<button
										onClick={() =>
											setIsDescriptionExpanded(
												!isDescriptionExpanded,
											)
										}
										className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 font-medium transition-colors"
									>
										{isDescriptionExpanded ? (
											<>
												<ChevronUp className="h-3.5 w-3.5" />
												Show less
											</>
										) : (
											<>
												<ChevronDown className="h-3.5 w-3.5" />
												Show more
											</>
										)}
									</button>
								)}
							</div>
						</motion.div>
					)}

					{/* Section 4 & 5: Comments / Trades Tabs - matching screenshot exactly */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="bg-card border border-border rounded-xl overflow-hidden"
					>
						<Tabs
							value={activeTab}
							onValueChange={(value) =>
								setActiveTab(value as "comments" | "trades")
							}
							className="w-full"
						>
							{/* Tab Headers */}
							<TabsList className=" h-auto bg-transparent border-0 p-0 gap-6 px-4 pt-4">
								<TabsTrigger
									value="comments"
									className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:shadow-[0_2px_8px_rgba(var(--primary),0.5)] border-b-2 border-transparent rounded-sm pb-2 text-sm font-medium"
								>
									Comments
								</TabsTrigger>
								<TabsTrigger
									value="trades"
									className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-green-500 data-[state=active]:shadow-[0_2px_8px_rgba(var(--primary),0.5)] border-b-2 border-transparent rounded-sm pb-2 text-sm font-medium"
								>
									Trades
								</TabsTrigger>
							</TabsList>

							<TabsContent
								value="comments"
								className="mt-0 border-0"
							>
								<TokenChat
									tokenId={id}
									className="min-h-100 border-0 rounded-none"
								/>
							</TabsContent>
							<TabsContent value="trades" className="mt-0">
								<TradeTape
									tokenId={id}
									tokenSymbol={token.symbol}
									initialTrades={trades}
									className="border-0 rounded-none"
								/>
							</TabsContent>
						</Tabs>
					</motion.div>
				</div>

				{/* Sidebar */}
				<div className="min-w-0 w-full lg:sticky lg:top-22 lg:self-start space-y-4 sm:space-y-6 overflow-y-scroll scroll-smooth lg:max-h-[calc(100vh-2rem)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
					{/* Vesting Panel (Only if HypeBoost is enabled) */}
					{token.hypeBoostEnabled && token.bondingCurveAddress && (
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							className="mb-6"
						>
							<VestingCard
								bondingCurveAddress={
									token.bondingCurveAddress as Address
								}
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
								bondingCurveAddress={
									token.bondingCurveAddress as Address
								}
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
									{nativeSymbol}
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

					{/* Section 4: Top Holders - as per screenshot 3 */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.3 }}
						className="bg-card border border-border rounded-xl p-4"
					>
						<div className="flex items-center justify-between mb-4">
							<span className="font-semibold text-sm">
								Top holders
							</span>
							<Button
								variant="outline"
								size="sm"
								className="text-xs h-7"
								onClick={() => setShowBubbleMap(true)}
							>
								Generate bubble map
							</Button>
						</div>
						{holdersLoading ? (
							<div className="space-y-2">
								{[...Array(10)].map((_, i) => (
									<div
										key={i}
										className="flex items-center justify-between"
									>
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-4 w-12" />
									</div>
								))}
							</div>
						) : holders.length > 0 ? (
							<div className="space-y-1">
								{holders.slice(0, 20).map((holder, index) => (
									<div
										key={holder.address}
										className="flex items-center justify-between py-1"
									>
										<Link
											href={`/user/${holder.address}`}
											className="font-mono text-sm hover:text-primary text-muted-foreground"
										>
											{index === 0 ? (
												<span className="flex items-center gap-1.5">
													Liquidity pool{" "}
													<span className="text-blue-400">
														💧
													</span>
												</span>
											) : (
												`${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`
											)}
										</Link>
										<span className="text-sm tabular-nums">
											{holder.percentage.toFixed(2)}%
										</span>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-6">
								<p className="text-xs text-muted-foreground">
									No holders data available yet
								</p>
							</div>
						)}
					</motion.div>
				</div>
			</div>

			{/* Share Modal */}
			<ShareMenuComponent />

			{/* Bubble Map Dialog */}
			<BubbleMapDialog
				open={showBubbleMap}
				onOpenChange={setShowBubbleMap}
				tokenAddress={token.contractAddress}
				tokenSymbol={token.symbol}
				chainId={token.chainId}
			/>
		</div>
	);
}
