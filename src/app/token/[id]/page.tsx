"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
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
	Zap,
	Globe,
	ExternalLink,
	MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
// import { AdvancedPriceChart } from "@/components/charts";
const AdvancedPriceChart = dynamic(
	() => import("@/components/charts").then((mod) => mod.AdvancedPriceChart),
	{ ssr: false },
);
import {
	BondingCurveProgress,
	TokenChat,
	VestingCard,
	BubbleMapDialog,
	PostGraduationWidget,
} from "@/components/token";
import { TradeTape, OnChainTradingPanel } from "@/components/trade";

import { useToken, tokenKeys, useTokenHolders } from "@/hooks/useTokens";
import { useTokenTrades, tradeKeys } from "@/hooks/useTrades";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useManualSync } from "@/hooks/useBlockchainSync";
import { usePersistedTabs } from "@/hooks/usePersistedTabs";
import { useAuth } from "@/hooks";
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
	truncateToDecimals,
} from "@/lib/utils";
import { getChainDisplayName } from "@/lib/wagmi/config";
import type { Address } from "viem";
import type { Token } from "@/types";
import dynamic from "next/dynamic";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

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
	const [showImageModal, setShowImageModal] = useState(false);
	const [socialLinkUrl, setSocialLinkUrl] = useState<string | null>(null);
	const { primaryWallet } = useDynamicContext();

	// Auth and follow hooks
	const { isAuthenticated, walletAddress, setShowAuthFlow } = useAuth();
	const followMutation = useFollowUser();
	const unfollowMutation = useUnfollowUser();

	const { data: token, isLoading, error } = useToken(id);
	const { data: tradesData } = useTokenTrades(id);
	console.log("token", token);

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

	// Get user's backend CPMM token balance for sell panel (Solana on-chain SPL balance is 0)
	const userBackendTokenBalance = useMemo(() => {
		if (!walletAddress || holders.length === 0) return undefined;
		const entry = holders.find(
			(h) => h.address?.toLowerCase() === walletAddress.toLowerCase(),
		);
		return entry?.balance; // raw 9-decimal string
	}, [walletAddress, holders]);

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

	// Prevent background scrolling on lg+ screens only (not on mobile)
	// useEffect(() => {
	// 	const mediaQuery = window.matchMedia("(min-width: 1024px)");

	// 	const applyOverflow = () => {
	// 		if (mediaQuery.matches) {
	// 			// Only apply overflow clip on lg+ screens
	// 			document.body.style.overflowY = "clip";
	// 		} else {
	// 			// Remove overflow clip on mobile/tablet
	// 			document.body.style.overflowY = "";
	// 		}
	// 	};

	// 	// Apply initial state
	// 	applyOverflow();

	// 	// Listen for screen size changes
	// 	mediaQuery.addEventListener("change", applyOverflow);

	// 	return () => {
	// 		// Cleanup: remove overflow and listener
	// 		document.body.style.overflowY = "";
	// 		mediaQuery.removeEventListener("change", applyOverflow);
	// 	};
	// }, []);

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
				// Token detail is updated optimistically via price:${id} channel below
				// — do NOT invalidate here to avoid race-condition refetch overwriting the optimistic update
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
							currentPriceUsd:
								message.data.priceUsd ||
								(() => {
									const np = parseFloat(
										oldData.nativePriceAtCreation || "0",
									);
									const p =
										message.data.price ||
										oldData.currentPrice;
									return np > 0
										? (parseFloat(p) * np).toFixed(18)
										: oldData.currentPriceUsd;
								})(),
							marketCap: message.data.marketCap,
							marketCapUsd:
								message.data.marketCapUsd ||
								(() => {
									const np = parseFloat(
										oldData.nativePriceAtCreation || "0",
									);
									const mc =
										message.data.marketCap ||
										oldData.marketCap;
									return np > 0
										? (parseFloat(mc) * np).toFixed(2)
										: oldData.marketCapUsd;
								})(),
							holdersCount:
								message.data.holdersCount ??
								oldData.holdersCount,
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
							circulatingSupply:
								message.data.circulatingSupply ??
								oldData.circulatingSupply,
							athProgress:
								message.data.athProgress ?? oldData.athProgress,
						};
					},
				);
			}

			// Handle graduation event — update status in cache
			if (
				message.channel === `token:${id}` &&
				message.event === "token_graduated"
			) {
				queryClient.setQueryData(
					tokenKeys.detail(id),
					(oldData: Token | undefined) => {
						if (!oldData) return oldData;
						return {
							...oldData,
							status: "graduated" as const,
							bondingCurveProgress: 100,
							dexPoolAddress: message.data.poolAddress ?? null,
							dexName: message.data.dexName ?? null,
						};
					},
				);
			}

			// Handle native price updates — recompute USD market cap in real-time (like pump.fun)
			if (
				message.channel === "native-prices" &&
				message.event === "price_update"
			) {
				queryClient.setQueryData(
					tokenKeys.detail(id),
					(oldData: Token | undefined) => {
						if (!oldData) return oldData;
						const chainId = Number(oldData.chainId);
						const nativePriceUsd = message.data.prices?.[chainId];
						if (!nativePriceUsd || nativePriceUsd <= 0)
							return oldData;
						const mcapNative = parseFloat(oldData.marketCap || "0");
						const priceNative = parseFloat(
							oldData.currentPrice || "0",
						);
						return {
							...oldData,
							marketCapUsd: (mcapNative * nativePriceUsd).toFixed(
								2,
							),
							currentPriceUsd: (
								priceNative * nativePriceUsd
							).toFixed(18),
							nativePriceUsd: nativePriceUsd.toString(),
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

	// Subscribe to token-specific channels + native price feed
	useEffect(() => {
		if (isConnected && id) {
			subscribe(`trades:${id}`);
			subscribe(`price:${id}`);
			subscribe(`token:${id}`);
			subscribe("native-prices");

			return () => {
				unsubscribe(`trades:${id}`);
				unsubscribe(`price:${id}`);
				unsubscribe(`token:${id}`);
				unsubscribe("native-prices");
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
		navigator.clipboard.writeText(token.contractAddress as string);
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
		<div className="w-full mx-auto p-2 xs:p-3 sm:p-4 lg:p-6 relative overflow-x-clip">
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] relative gap-3 sm:gap-4 lg:gap-6">
				{/* Main Content — on mobile, `contents` makes children direct grid items so we can reorder them */}
				<div className="contents lg:block lg:min-w-0 lg:space-y-6 lg:w-full lg:sticky lg:top-22 lg:self-start lg:overflow-y-auto lg:scroll-smooth lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]">
					{/* Section 1: Token Header Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-card border border-border rounded-xl p-3 sm:p-4 order-1 lg:order-none"
					>
						<div className="flex flex-col gap-2 xs:gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
							{/* Left side: Image, Name, Symbol, Creator, Time */}
							<div className="flex items-center gap-3 min-w-0 flex-1">
								{/* Token Image with dynamic gradient border */}
								{(() => {
									const progress =
										token.bondingCurveProgress ?? 0;
									const isGraduated =
										token.status === "graduated" ||
										progress >= 100;
									const borderGradient = isGraduated
										? "linear-gradient(135deg, #ffd700, #ff8c00, #ffd700)"
										: progress > 80
											? "linear-gradient(135deg, #ff8c00, #ff6b00, #ffa040)"
											: progress > 60
												? "linear-gradient(135deg, #ffd200, #ffb800, #ffe066)"
												: "linear-gradient(135deg, #00ff88, #00cc6a, #22c55e)";

									const bondingAmount = fromWei(
										token.currentBondingAmount || "0",
									);

									return (
										<div className="w-14 h-14 rounded-lg shrink-0 relative">
											{/* Gradient border background */}
											<div
												className="absolute inset-0 rounded-lg cursor-pointer transition-transform hover:scale-105"
												style={{
													background: borderGradient,
												}}
												onClick={() =>
													setShowImageModal(true)
												}
											/>
											{/* Inner image area - no pointer events propagation to border */}
											<div
												className="absolute inset-0.5 p-1 rounded-lg bg-muted overflow-hidden cursor-pointer z-1"
												onClick={() =>
													setShowImageModal(true)
												}
											>
												{token.imageUrl ? (
													<Image
														src={token.imageUrl.replace(
															"0.0.0.0",
															"localhost",
														)}
														alt={
															token.name ||
															"Token"
														}
														width={52}
														height={52}
														unoptimized
														className="object-cover w-full h-full rounded-[6px]"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
														{token.symbol?.slice(
															0,
															2,
														) || "??"}
													</div>
												)}
											</div>
											{/* Border-only hover zone with tooltip - always shown */}
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div
															className="absolute inset-0 rounded-lg z- ointer-events-none"
															style={
																{
																	/* Ring that only catches pointer events on the 2px border */
																}
															}
														>
															{/* Top edge */}
															<div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-auto cursor-help" />
															{/* Bottom edge */}
															<div className="absolute bottom-0 left-0 right-0 h-0.5ointer-events-auto cursor-help" />
															{/* Left edge */}
															<div className="absolute top-0 left-0 bottom-0 w-0.5ointer-events-auto cursor-help" />
															{/* Right edge */}
															<div className="absolute top-0 right-0 bottom-0 w-0.5ointer-events-auto cursor-help" />
														</div>
													</TooltipTrigger>
													<TooltipContent
														side="top"
														className="bg-zinc-900 border-zinc-700 text-white text-xs"
														arrowClassName="bg-zinc-900 fill-zinc-900"
													>
														{isGraduated ? (
															<p>
																This coin has
																graduated from
																the bonding
																curve
															</p>
														) : (
															<div>
																<p className="font-semibold">
																	Bonding
																	Curve
																	Progress:{" "}
																	{progress.toFixed(
																		1,
																	)}
																	%
																</p>
																<p className="text-zinc-400 mt-0.5">
																	There is{" "}
																	{bondingAmount.toFixed(
																		4,
																	)}{" "}
																	{
																		token
																			.nativeCurrency
																			?.symbol
																	}{" "}
																	in the
																	bonding
																	curve
																</p>
															</div>
														)}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									);
								})()}
								<div>
									<div className="flex items-center gap-2 flex-wrap">
										<h1 className="text-sm xs:text-base sm:text-lg font-bold wrap-break-words">
											{token.name}
										</h1>
										<span className="text-xs sm:text-sm text-muted-foreground">
											{token.symbol}
										</span>
										{token.hypeBoostEnabled && (
											<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium shrink-0">
												<Zap className="h-2.5 w-2.5 fill-amber-400" />
												HYPE
											</span>
										)}
									</div>
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<Link
											href={`/user/${token.creator?.walletAddress || ""}`}
											className="hover:text-primary flex items-center gap-1"
										>
											<UserAvatar
												userId={
													token.creator?.id ||
													token.creatorId ||
													""
												}
												avatarUrl={
													token.creator?.avatarUrl
												}
												username={
													token.creator?.username ||
													token.creator
														?.displayName ||
													undefined
												}
												sizeClassName="size-4"
											/>
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
							<div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0 flex-wrap">
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
									className="gap-1 sm:gap-1.5 text-xs px-2 sm:px-3"
								>
									{copied ? (
										<Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
									) : (
										<Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
									)}
									<span className="hidden xs:inline text-xs">
										{formatAddress(
											token.contractAddress as string,
										)}
									</span>
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

					{/* Section 2: Price Chart */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						className="bg-card border border-border rounded-xl overflow-hidden order-2 lg:order-0"
					>
						{/* Market Cap Header */}
						<div className="p-3 sm:p-4 border-b border-border">
							<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 lg:gap-0">
								<div>
									<p className="text-[10px] sm:text-xs text-muted-foreground mb-1">
										Market Cap
									</p>
									<p className="text-xl xs:text-2xl sm:text-3xl font-bold">
										{formatMarketCap(
											token.marketCapUsd ||
												token.marketCap,
											2,
										)}
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
								{/* ATH Progress */}
								<div className="lg:text-right flex flex-col lg:items-end gap-1 sm:gap-1.5">
									<p className="text-xs text-muted-foreground">
										ATH Progress
									</p>
									{(token.tradesCount ?? 0) === 0 ? (
										<span className="text-sm font-semibold text-muted-foreground/60">
											N/A
										</span>
									) : (
										<div className="flex items-center gap-2">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="relative w-32 xs:w-40 sm:w-48 md:w-56 lg:w-48 xl:w-68 h-2 bg-[#222] rounded-full cursor-help">
															<div
																className="h-full rounded-full transition-[width] duration-800 ease-out"
																style={{
																	width: `${Math.min(100, Math.max(0, token.athProgress ?? 0))}%`,
																	background:
																		(() => {
																			const p =
																				token.athProgress ??
																				0;
																			if (
																				p >=
																				85
																			)
																				return "linear-gradient(to right, #ff6b00, #ff2d00)";
																			if (
																				p >=
																				60
																			)
																				return "linear-gradient(to right, #ffd200, #ff8c00)";
																			return "linear-gradient(to right, #00ff88, #00cc6a)";
																		})(),
																	boxShadow:
																		(token.athProgress ??
																			0) >
																		0
																			? (() => {
																					const p =
																						token.athProgress ??
																						0;
																					if (
																						p >=
																						85
																					)
																						return "0 0 8px rgba(255, 107, 0, 0.5)";
																					if (
																						p >=
																						60
																					)
																						return "0 0 8px rgba(255, 210, 0, 0.4)";
																					return "0 0 8px rgba(0, 255, 136, 0.4)";
																				})()
																			: "none",
																}}
															/>
															{(token.athProgress ??
																0) >= 100 && (
																<motion.img
																	initial={{
																		opacity: 0,
																	}}
																	animate={{
																		opacity: 1,
																	}}
																	transition={{
																		delay: 0.8,
																		duration: 0.5,
																		ease: "easeOut",
																	}}
																	src="/spark.gif"
																	alt="ATH"
																	className="absolute -right-3.5 top-1/2 -translate-y-1/2 size-9 pointer-events-none"
																/>
															)}
														</div>
													</TooltipTrigger>

													<TooltipContent
														side="top"
														className="bg-zinc-900 border-zinc-700 text-white text-xs"
														arrowClassName="bg-zinc-900 fill-zinc-900"
													>
														<p>
															Current market cap
															relative to ATH
														</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="text-sm font-semibold tabular-nums cursor-help text-amber-400">
															$
															{(() => {
																const athP =
																	parseFloat(
																		token.athPrice ||
																			"0",
																	);
																const nativeP =
																	token.nativePriceAtCreation
																		? Number(
																				token.nativePriceAtCreation,
																			)
																		: 0;
																const athMcapUsd =
																	athP *
																	1_000_000_000 *
																	nativeP;
																if (
																	athMcapUsd >=
																	1_000_000
																)
																	return (
																		(
																			athMcapUsd /
																			1_000_000
																		).toFixed(
																			2,
																		) + "M"
																	);
																if (
																	athMcapUsd >=
																	1_000
																)
																	return (
																		(
																			athMcapUsd /
																			1_000
																		).toFixed(
																			2,
																		) + "K"
																	);
																return athMcapUsd.toFixed(
																	2,
																);
															})()}
														</span>
													</TooltipTrigger>
													<TooltipContent
														side="top"
														className="bg-zinc-900 border-zinc-700 text-white text-xs"
														arrowClassName="bg-zinc-900 fill-zinc-900"
													>
														<p>
															All-Time High Market
															Cap (USD)
														</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Advanced Price Chart with Tools and Indicators */}
						<div className="h-[50dvh] sm:h-[55dvh] lg:h-[55dvh]">
							<AdvancedPriceChart
								tokenId={id}
								className="border-none rounded-none h-full"
								showToolbar={true}
							/>
						</div>
					</motion.div>

					{/* Section 3: Metrics Row */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
						className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 order-3 lg:order-0"
					>
						<div className="bg-card border border-border rounded-lg p-2 sm:p-3 text-center">
							<p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
								Vol 24h
							</p>
							<p className="text-xs sm:text-sm font-semibold tabular-nums">
								{formatVolume(token.volume24h)}
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-2 sm:p-3 text-center">
							<p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
								Price
							</p>
							<p className="text-xs sm:text-sm font-semibold tabular-nums">
								{formatPrice(
									token.currentPriceUsd || token.currentPrice,
								)}
							</p>
						</div>
						<div className="bg-card border border-border rounded-lg p-2 sm:p-3 text-center">
							<p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
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
						<div className="bg-card border border-border rounded-lg p-2 sm:p-3 text-center">
							<p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
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
						<div className="bg-card border border-border rounded-lg p-2 sm:p-3 text-center col-span-2 xs:col-span-1">
							<p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
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

					{/* Section 3.5: Token Description with Social Links */}
					{(token.description ||
						token.websiteUrl ||
						token.twitterUrl ||
						token.telegramUrl ||
						token.discordUrl) && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.18 }}
							className="bg-card border border-border rounded-xl p-3 sm:p-4 order-8 lg:order-none"
						>
							{/* Social Link Badges */}
							{(token.websiteUrl ||
								token.twitterUrl ||
								token.telegramUrl ||
								token.discordUrl) && (
								<div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
									{token.websiteUrl && (
										<button
											onClick={() =>
												setSocialLinkUrl(
													token.websiteUrl!,
												)
											}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
										>
											<Globe className="h-3.5 w-3.5" />
											Website
										</button>
									)}
									{token.twitterUrl && (
										<button
											onClick={() =>
												setSocialLinkUrl(
													token.twitterUrl!,
												)
											}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
										>
											<svg
												className="h-3.5 w-3.5"
												viewBox="0 0 24 24"
												fill="currentColor"
											>
												<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
											</svg>
											Twitter
										</button>
									)}
									{token.telegramUrl && (
										<button
											onClick={() =>
												setSocialLinkUrl(
													token.telegramUrl!,
												)
											}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
										>
											<MessageCircle className="h-3.5 w-3.5" />
											Telegram
										</button>
									)}
									{token.discordUrl && (
										<button
											onClick={() =>
												setSocialLinkUrl(
													token.discordUrl!,
												)
											}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
										>
											<MessageCircle className="h-3.5 w-3.5" />
											Discord
										</button>
									)}
								</div>
							)}

							{token.description && (
								<>
									<div className="flex items-center justify-between mb-2">
										<h3 className="text-sm font-semibold">
											About {token.symbol}
										</h3>
										{/* Accordion toggle — visible only below lg */}
										{token.description.length > 80 && (
											<button
												onClick={() =>
													setIsDescriptionExpanded(
														!isDescriptionExpanded,
													)
												}
												className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors lg:hidden"
											>
												{isDescriptionExpanded ? (
													<>
														<span className="hidden xs:inline">
															Show less
														</span>
														<ChevronUp className="h-4 w-4" />
													</>
												) : (
													<>
														<span className="hidden xs:inline">
															Show more
														</span>
														<ChevronDown className="h-4 w-4" />
													</>
												)}
											</button>
										)}
									</div>
									{/* Description — smooth framer-motion accordion on mobile, always visible on lg+ */}
									<motion.div
										className="overflow-hidden lg:overflow-visible! lg:h-auto!"
										initial={false}
										animate={{
											height: isDescriptionExpanded
												? "auto"
												: "2.8em",
										}}
										transition={{
											duration: 0.4,
											ease: [0.25, 0.1, 0.25, 1],
										}}
									>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap wrap-break-word">
											{token.description}
										</p>
									</motion.div>
								</>
							)}
						</motion.div>
					)}

					{/* Section 4 & 5: Comments / Trades Tabs */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="bg-card border border-border rounded-xl overflow-hidden order-9 lg:order-none"
					>
						<Tabs
							value={activeTab}
							onValueChange={(value) =>
								setActiveTab(value as "comments" | "trades")
							}
							className="w-full"
						>
							{/* Tab Headers */}
							<TabsList className="h-auto bg-transparent border-0 p-0 gap-4 sm:gap-6 px-3 sm:px-4 pt-3 sm:pt-4">
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
									nativeTokenSymbol={
										token?.nativeCurrency?.symbol
									}
									initialTrades={trades}
									chainId={token.chainId}
									className="border-0 rounded-none"
								/>
							</TabsContent>
						</Tabs>
					</motion.div>
				</div>

				{/* Sidebar — on mobile, `contents` lets children participate in the grid for reordering */}
				<div className="contents lg:block lg:min-w-0 lg:w-full lg:sticky lg:top-22 lg:self-start lg:space-y-6 lg:overflow-y-auto lg:scroll-smooth lg:max-h-[calc(100vh-6.5rem)] lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]">
					{/* Vesting Panel (Only if HypeBoost is enabled) */}
					{token.hypeBoostEnabled && token.bondingCurveAddress && (
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							className="order-4 lg:order-none"
						>
							<VestingCard
								bondingCurveAddress={
									token.bondingCurveAddress as Address
								}
								symbol={token.symbol}
							/>
						</motion.div>
					)}

					{/* login button to trade */}
					{!primaryWallet && (
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.1 }}
							className="order-4 lg:order-none"
						>
							<div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-4">
								<p className="text-sm text-muted-foreground">
									Please log in to access trading features.
								</p>
								<Button
									onClick={() => setShowAuthFlow(true)}
									className="w-full cursor-pointer"
								>
									Log In
								</Button>
							</div>
						</motion.div>
					)}
					{/* Trading Panel - On-Chain Only (user pays gas for buy/sell) */}
					{primaryWallet &&
						token.bondingCurveAddress &&
						token.contractAddress && (
							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								className="order-4 lg:order-none"
							>
								<OnChainTradingPanel
									tokenId={id}
									tokenAddress={
										token.contractAddress as Address
									}
									bondingCurveAddress={
										token.bondingCurveAddress as Address
									}
									nativeSymbol={
										token.nativeCurrency?.symbol as string
									}
									tokenSymbol={token.symbol || "TOKEN"}
									tokenName={token.name || "Unknown Token"}
									currentPrice={
										token.currentPrice || "0.00001"
									}
									chainType={
										token.chainType === "SOLANA"
											? "SOLANA"
											: "EVM"
									}
									chainId={token.chainId}
									backendTokenBalance={
										userBackendTokenBalance
									}
									circulatingSupply={token.circulatingSupply}
								/>
							</motion.div>
						)}

					{/* Token creation pending - no contract address yet */}
					{primaryWallet &&
						(!token.contractAddress ||
							!token.bondingCurveAddress) && (
							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								className="order-4 lg:order-none"
							>
								<div className="bg-card border border-border rounded-xl p-6 text-center">
									<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
									<h3 className="font-semibold text-sm mb-1">
										Token Creation Pending
									</h3>
									<p className="text-xs text-muted-foreground">
										This token is being deployed on-chain.
										Trading will be available once the
										contract is confirmed.
									</p>
								</div>
							</motion.div>
						)}

					{/* Bonding Curve */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.1 }}
						className="bg-card border border-border rounded-xl p-3 sm:p-4 order-5 lg:order-none"
					>
						<BondingCurveProgress
							nativeSymbol={
								token.nativeCurrency?.symbol as string
							}
							progress={token.bondingCurveProgress ?? 0}
							currentAmount={token.currentBondingAmount || "0"}
							targetAmount={token.graduationTarget || "100"}
							nativePriceUsd={
								token.nativePriceAtCreation
									? Number(token.nativePriceAtCreation)
									: null
							}
							graduationThresholdUsd={
								token.graduationThresholdUsd ?? null
							}
						/>
					</motion.div>

					{/* Post-Graduation DEX Widget — only show when token is explicitly graduated */}
					{(token.status === "graduated" ||
						token.isGraduated === true) && (
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.15 }}
							className="order-5 lg:order-none"
						>
							<PostGraduationWidget
								tokenAddress={token.contractAddress || ""}
								poolAddress={(token as any).dexPoolAddress}
								dexName={(token as any).dexName}
								chainId={token.chainId}
							/>
						</motion.div>
					)}

					{/* Token Info */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.2 }}
						className="bg-card border border-border rounded-xl p-3 sm:p-4 order-6 lg:order-none"
					>
						<div className="flex items-center gap-2 mb-3 sm:mb-4">
							<Info className="h-4 w-4 text-muted-foreground" />
							<span className="font-semibold text-sm">
								Token Info
							</span>
						</div>
						<div className="space-y-2 sm:space-y-3">
							<div className="flex items-center justify-between gap-2">
								<span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
									Total Supply
								</span>
								<span className="text-xs sm:text-sm font-mono tabular-nums truncate">
									{parseFloat(
										token.totalSupply || "1000000000",
									).toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
									Circulating
								</span>
								<span className="text-xs sm:text-sm font-mono tabular-nums truncate">
									{Number(
										truncateToDecimals(
											parseFloat(
												token.circulatingSupply as string,
											),
											3,
										),
									).toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
									Reserve
								</span>
								<span className="text-xs sm:text-sm font-mono tabular-nums truncate">
									{truncateToDecimals(
										parseFloat(token.currentBondingAmount),
										4,
									)}{" "}
									{token.nativeCurrency?.symbol}
								</span>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
									Network
								</span>
								<Badge
									variant="outline"
									className="text-[10px] sm:text-xs"
								>
									{getChainDisplayName(token.chainId)}
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

					{/* Top Holders */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.3 }}
						className="bg-card border border-border rounded-xl p-3 sm:p-4 order-7 lg:order-none"
					>
						<div className="flex items-center justify-between mb-3 sm:mb-4">
							<span className="font-semibold text-sm">
								Top holders
							</span>
							<Button
								variant="outline"
								size="sm"
								className="text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3"
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
								{holders.slice(0, 20).map((holder, index) => {
									const isCreator =
										creatorAddress &&
										holder.address.toLowerCase() ===
											creatorAddress.toLowerCase();
									return (
										<div
											key={holder.address}
											className="flex items-center justify-between py-1"
										>
											<Link
												href={`/user/${holder.address}`}
												className="font-mono text-xs sm:text-sm hover:text-primary text-muted-foreground"
											>
												{index === 0 && !isCreator ? (
													<span className="flex items-center gap-1.5">
														Liquidity pool{" "}
														<span className="text-blue-400">
															💧
														</span>
													</span>
												) : (
													<span className="flex items-center gap-1.5">
														{`${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`}
														{isCreator && (
															// <span
															// 	className="text-base"
															// 	title="Developer (initial purchase)"
															// >
															// 	🎩
															// </span>
															<div className="text-foreground flex text-xs gap-2 items-center">
																(
																<span>DEV</span>
																<img
																	src="/hacker.png"
																	alt=""
																	className="w-4 h-4 bg-white rounded-full"
																/>
																)
															</div>
														)}
													</span>
												)}
											</Link>
											<span className="text-sm tabular-nums">
												{holder.percentage.toFixed(2)}%
											</span>
										</div>
									);
								})}
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

			{/* Image Preview Modal */}
			<Dialog open={showImageModal} onOpenChange={setShowImageModal}>
				<DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border p-0 overflow-hidden">
					<DialogTitle className="sr-only">
						{token.name} Preview
					</DialogTitle>
					<div className="flex flex-col items-center">
						<div className="text-center py-4">
							<h2 className="text-lg font-bold">{token.name}</h2>
							<p className="text-sm text-muted-foreground">
								${token.symbol}
							</p>
						</div>
						{token.imageUrl ? (
							<div className="w-full aspect-square max-h-[70vh] relative">
								<Image
									src={token.imageUrl.replace(
										"0.0.0.0",
										"localhost",
									)}
									alt={token.name || "Token"}
									fill
									unoptimized
									className="object-contain"
								/>
							</div>
						) : (
							<div className="w-full aspect-square flex items-center justify-center text-6xl font-bold text-muted-foreground bg-muted">
								{token.symbol?.slice(0, 2) || "??"}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Bubble Map Dialog */}
			<BubbleMapDialog
				open={showBubbleMap}
				onOpenChange={setShowBubbleMap}
				tokenAddress={token.contractAddress}
				tokenSymbol={token.symbol}
				chainId={token.chainId}
			/>

			{/* Social Link Confirmation Dialog */}
			<Dialog
				open={!!socialLinkUrl}
				onOpenChange={(open) => !open && setSocialLinkUrl(null)}
			>
				<DialogContent className="sm:max-w-md bg-card border-border">
					<DialogTitle className="text-base font-semibold">
						External Link
					</DialogTitle>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							You are about to visit an external website. Please
							make sure you trust this link before proceeding.
						</p>
						<div className="p-3 bg-muted/50 rounded-lg border border-border break-all">
							<p className="text-sm font-mono text-foreground">
								{socialLinkUrl}
							</p>
						</div>
						<div className="flex gap-3 justify-end">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSocialLinkUrl(null)}
							>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={() => {
									window.open(
										socialLinkUrl!,
										"_blank",
										"noopener,noreferrer",
									);
									setSocialLinkUrl(null);
								}}
								className="gap-1.5"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Visit Site
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
