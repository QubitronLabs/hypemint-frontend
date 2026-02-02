"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Zap,
	BarChart3,
	Sparkles,
	Search,
	// Rocket,
	Flame,
	// TrendingUp,
	Clock,
	Trophy,
	Plus,
	LayoutGrid,
	List,
	// Wifi,
	// WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenCard, TokenListItem } from "@/components/token";
import {
	useTrendingTokens,
	useNewTokens,
	useTokens,
	useLiveTokens,
	useGraduatedTokens,
	tokenKeys,
} from "@/hooks/useTokens";
import { usePersistedTabs } from "@/hooks/usePersistedTabs";
import {
	useNewTokenFeed,
	useGlobalTradeFeed,
	useTokenGraduations,
} from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { Token } from "@/types";

// Filter tabs configuration
const FILTER_TABS = [
	{ id: "all", label: "All", icon: BarChart3, description: "All tokens" },
	{
		id: "trending",
		label: "Trending",
		icon: Flame,
		description: "Hot right now",
	},
	{ id: "new", label: "New", icon: Sparkles, description: "Just launched" },
	{ id: "live", label: "Live", icon: Zap, description: "Active trading" },
	{
		id: "graduated",
		label: "Graduated",
		icon: Trophy,
		description: "Made it",
	},
] as const;

type FilterTab = (typeof FILTER_TABS)[number]["id"];

// Valid tabs array for the persisted tabs hook
const VALID_TABS: readonly FilterTab[] = [
	"all",
	"trending",
	"new",
	"live",
	"graduated",
] as const;

// Live activity indicator component
// function LiveIndicator({ isConnected }: { isConnected: boolean }) {
// 	return (
// 		<div
// 			className={cn(
// 				"flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
// 				isConnected
// 					? "bg-green-500/10 text-green-500 border border-green-500/20"
// 					: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
// 			)}
// 		>
// 			{isConnected ? (
// 				<>
// 					<span className="relative flex h-2 w-2">
// 						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
// 						<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
// 					</span>
// 					<Wifi className="h-3 w-3" />
// 					<span>Live</span>
// 				</>
// 			) : (
// 				<>
// 					<WifiOff className="h-3 w-3" />
// 					<span>Connecting...</span>
// 				</>
// 			)}
// 		</div>
// 	);
// }

// Recent activity feed item
interface ActivityItem {
	id: string;
	type: "new_token" | "trade";
	tokenSymbol: string;
	tokenName?: string;
	message: string;
	timestamp: number;
}

// function ActivityFeed({ items }: { items: ActivityItem[] }) {
// 	if (items.length === 0) return null;

// 	return (
// 		<div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-4">
// 			<div className="flex items-center gap-2 mb-3">
// 				<Zap className="h-4 w-4 text-primary" />
// 				<span className="text-sm font-medium">Live Activity</span>
// 			</div>
// 			<div className="space-y-2 max-h-[200px] overflow-y-auto">
// 				<AnimatePresence mode="popLayout">
// 					{items.slice(0, 5).map((item) => (
// 						<motion.div
// 							key={item.id}
// 							initial={{ opacity: 0, x: -20, height: 0 }}
// 							animate={{ opacity: 1, x: 0, height: "auto" }}
// 							exit={{ opacity: 0, x: 20, height: 0 }}
// 							className="flex items-center gap-3 text-sm py-2 border-b border-border/30 last:border-0"
// 						>
// 							<div
// 								className={cn(
// 									"w-8 h-8 rounded-lg flex items-center justify-center",
// 									item.type === "new_token"
// 										? "bg-primary/20 text-primary"
// 										: "bg-green-500/20 text-green-500",
// 								)}
// 							>
// 								{item.type === "new_token" ? (
// 									<Sparkles className="h-4 w-4" />
// 								) : (
// 									<TrendingUp className="h-4 w-4" />
// 								)}
// 							</div>
// 							<div className="flex-1 min-w-0">
// 								<p className="text-foreground truncate">
// 									{item.message}
// 								</p>
// 								<p className="text-xs text-muted-foreground">
// 									{new Date(
// 										item.timestamp,
// 									).toLocaleTimeString()}
// 								</p>
// 							</div>
// 						</motion.div>
// 					))}
// 				</AnimatePresence>
// 			</div>
// 		</div>
// 	);
// }

// Stats card component
// function StatsCard({
// 	icon: Icon,
// 	label,
// 	value,
// 	trend,
// }: {
// 	icon: React.ElementType;
// 	label: string;
// 	value: string;
// 	trend?: number;
// }) {
// 	return (
// 		<div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-3 sm:p-4">
// 			<div className="flex items-center gap-2 sm:gap-3">
// 				<div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
// 					<Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
// 				</div>
// 				<div className="min-w-0">
// 					<p className="text-lg sm:text-2xl font-bold truncate">
// 						{value}
// 					</p>
// 					<p className="text-[10px] sm:text-xs text-muted-foreground truncate">
// 						{label}
// 					</p>
// 				</div>
// 				{trend !== undefined && (
// 					<div
// 						className={cn(
// 							"ml-auto text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shrink-0",
// 							trend >= 0
// 								? "bg-green-500/10 text-green-500"
// 								: "bg-red-500/10 text-red-500",
// 						)}
// 					>
// 						{trend >= 0 ? "+" : ""}
// 						{trend}%
// 					</div>
// 				)}
// 			</div>
// 		</div>
// 	);
// }

function HomePage() {
	// Use persisted tabs hook for URL-based tab state persistence
	const {
		activeTab: activeFilter,
		setActiveTab: setActiveFilter,
		isHydrated,
	} = usePersistedTabs({
		key: "filter",
		defaultTab: "all" as FilterTab,
		validTabs: VALID_TABS,
	});

	// Debounced filter state to prevent rapid API calls when switching tabs quickly
	const [debouncedFilter, setDebouncedFilter] = useState<FilterTab>(activeFilter);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	// Debounce the filter changes (300ms delay)
	useEffect(() => {
		// Clear any existing timeout
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		// Set up new debounced update
		debounceRef.current = setTimeout(() => {
			setDebouncedFilter(activeFilter);
		}, 300);

		// Cleanup on unmount or when activeFilter changes
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [activeFilter]);

	const [searchQuery, setSearchQuery] = useState("");
	const [mounted, setMounted] = useState(false);
	// const [wsConnected, setWsConnected] = useState(false);
	const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
	
	// View mode state: 'grid' or 'list' (default is grid)
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

	// Prevent hydration mismatch
	useEffect(() => {
		function blahBlah() {
			setMounted(true);
		}
		blahBlah();
	}, []);

	// Fetch data - ONLY call API for the active tab
	// All tokens (for "all" tab)
	// Query Client for cache updates
	const queryClient = useQueryClient();

	// Fetch data - ONLY call API for the debounced tab (prevents rapid API calls)
	// All tokens (for "all" tab)
	const { data: allTokens = [], isLoading: allLoading } = useTokens(
		{ page: 1, pageSize: 50 },
		{ enabled: isHydrated && debouncedFilter === "all" },
	);

	// Trending tokens (for "trending" tab)
	const {
		data: trendingTokens = [],
		isLoading: trendingLoading,
	} = useTrendingTokens(undefined, {
		enabled: isHydrated && debouncedFilter === "trending",
	});

	// New tokens (for "new" tab)
	const {
		data: newTokens = [],
		isLoading: newLoading,
	} = useNewTokens(undefined, {
		enabled: isHydrated && debouncedFilter === "new",
	});

	// Live tokens (for "live" tab)
	const {
		data: liveTokens = [],
		isLoading: liveLoading,
	} = useLiveTokens(undefined, {
		enabled: isHydrated && debouncedFilter === "live",
	});

	// Graduated tokens (for "graduated" tab)
	const {
		data: graduatedTokens = [],
		isLoading: graduatedLoading,
	} = useGraduatedTokens(undefined, {
		enabled: isHydrated && debouncedFilter === "graduated",
	});

	// WebSocket: Listen for new tokens
	useNewTokenFeed(
		useCallback(
			(newToken: any) => {
				// setWsConnected(true);

				// Add to activity feed
				const activity: ActivityItem = {
					id: `token-${newToken.tokenId}-${Date.now()}`,
					type: "new_token",
					tokenSymbol: newToken.symbol,
					tokenName: newToken.name,
					message: `${newToken.name} ($${newToken.symbol}) just launched!`,
					timestamp: Date.now(),
				};

				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

				// Optimistically add new token to lists without refetching
				const formattedToken: Token = {
					id: newToken.id || newToken.tokenId,
					name: newToken.name,
					symbol: newToken.symbol,
					imageUrl: newToken.imageUrl,
					description: newToken.description,
					creatorId: newToken.creatorId,
					creator: newToken.creator, // Now populated from backend
					chainId: newToken.chainId,
					status: "active",
					hypeBoostEnabled: newToken.hypeBoostEnabled || false,
					createdAt: newToken.createdAt || new Date().toISOString(),
					updatedAt: new Date().toISOString(),

					// Defaults for new token
					currentPrice: "0",
					initialPrice: "0",
					marketCap: "0",
					volume24h: "0",
					priceChange24h: 0,
					bondingCurveProgress: 0,
					graduationTarget: "69000000000000000000000",
					currentBondingAmount: "0",
					holdersCount: 0,
					tradesCount: 0,
					totalSupply: "1000000000000000000000000000",
				} as Token;

				const prependToken = (oldData: any) => {
					if (!oldData || !Array.isArray(oldData)) return oldData;
					// Avoid duplicate
					if (oldData.some((t: Token) => t.id === formattedToken.id))
						return oldData;

					return [formattedToken, ...oldData];
				};

				// Prepend to All and New lists
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.lists() },
					prependToken,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.new() },
					prependToken,
				);
			},
			[queryClient],
		),
	);

	// WebSocket: Listen for trades - update token data in cache directly without refetch
	useGlobalTradeFeed(
		useCallback(
			(trade) => {
				// setWsConnected(true);

				const activity: ActivityItem = {
					id: `trade-${trade.tradeId}-${Date.now()}`,
					type: "trade",
					tokenSymbol: trade.tokenSymbol,
					message: `${trade.username || "Someone"} ${trade.type === "buy" ? "bought" : "sold"} $${trade.tokenSymbol}`,
					timestamp: Date.now(),
				};

				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

				// Optimistically update cache with new data from WS (bondingCurveProgress, marketCap)
				// This avoids refetching the API repeatedly
				const updateTokenInCache = (oldData: any) => {
					if (!oldData || !Array.isArray(oldData)) return oldData;

					return oldData.map((token: Token) => {
						if (token.id === trade.tokenId) {
							// Merge existing token with new data from WebSocket
							// trade object now contains computed bondingCurveProgress and marketCap from backend
							const wsProgress = trade.bondingCurveProgress;
							const wsMarketCap = trade.marketCap;

							return {
								...token,
								bondingCurveProgress:
									wsProgress !== undefined
										? wsProgress
										: token.bondingCurveProgress,
								marketCap:
									wsMarketCap !== undefined
										? wsMarketCap
										: token.marketCap,
								// Also update volume if provided or accumulate
								// volume24h: ... (logic complex without full data, skipping for now as progress is priority)
							};
						}
						return token;
					});
				};

				// Update all relevant token list queries
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.lists() },
					updateTokenInCache,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.trending() },
					updateTokenInCache,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.new() },
					updateTokenInCache,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.live({}) },
					updateTokenInCache,
				); // Rough match
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.graduated({}) },
					updateTokenInCache,
				);
			},
			[queryClient],
		),
	);

	// WebSocket: Listen for token graduations
	useTokenGraduations(
		useCallback(
			(data) => {
				const activity: ActivityItem = {
					id: `graduation-${data.tokenId}-${Date.now()}`,
					type: "trade", // Re-using trade type for icon consistency or generic
					tokenSymbol: data.symbol,
					message: `🎓 ${data.name} ($${data.symbol}) just GRADUATED!`,
					timestamp: Date.now(),
				};

				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

				// Update status in all lists to 'graduated'
				const markAsGraduated = (oldData: any) => {
					if (!oldData || !Array.isArray(oldData)) return oldData;

					return oldData.map((token: Token) => {
						if (token.id === data.tokenId) {
							return {
								...token,
								status: "graduated",
								graduatedAt: new Date().toISOString(),
								bondingCurveProgress: 100,
							};
						}
						return token;
					});
				};

				queryClient.setQueriesData(
					{ queryKey: tokenKeys.lists() },
					markAsGraduated,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.trending() },
					markAsGraduated,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.new() },
					markAsGraduated,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.live({}) },
					markAsGraduated,
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.graduated({}) },
					markAsGraduated,
				);
			},
			[queryClient],
		),
	);

	// Determine display tokens based on active tab
	const getDisplayTokens = (): Token[] => {
		switch (activeFilter) {
			case "trending":
				return Array.isArray(trendingTokens) ? trendingTokens : [];
			case "new":
				return Array.isArray(newTokens) ? newTokens : [];
			case "graduated":
				return Array.isArray(graduatedTokens) ? graduatedTokens : [];
			case "live":
				return Array.isArray(liveTokens) ? liveTokens : [];
			case "all":
			default:
				return Array.isArray(allTokens) ? allTokens : [];
		}
	};

	const tokens = getDisplayTokens();

	// Determine loading state based on active tab
	const isLoading = (() => {
		switch (activeFilter) {
			case "all":
				return allLoading;
			case "trending":
				return trendingLoading;
			case "new":
				return newLoading;
			case "live":
				return liveLoading;
			case "graduated":
				return graduatedLoading;
			default:
				return false;
		}
	})();

	// Search filtering
	const filteredTokens = tokens.filter(
		(token: Token) =>
			token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			token.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	if (!mounted || !isHydrated) return null;

	return (
		<main className="min-h-screen pb-20">
			<div className="mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
				{/* Hero Section - Clean and Minimal */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-6 sm:mb-8"
				>
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
						<div className="flex-1">
							<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
								Trending Coins
							</h1>
							<p className="text-sm sm:text-base text-muted-foreground">
								Find the next moonshot or launch your own
							</p>
						</div>

						 
					</div>
				</motion.div>

				{/* Stats Row */}
				{/* <motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8"
				>
					<StatsCard
						icon={Rocket}
						label="Total Tokens"
						value={tokens.length.toString()}
					/>
					<StatsCard
						icon={Flame}
						label="Trending"
						value={
							activeFilter === "trending"
								? trendingTokens.length.toString()
								: "—"
						}
						trend={activeFilter === "trending" ? 12 : undefined}
					/>
					<StatsCard
						icon={Clock}
						label="New Today"
						value={
							activeFilter === "new"
								? newTokens.length.toString()
								: "—"
						}
					/>
					<StatsCard
						icon={Trophy}
						label="Graduated"
						value={
							activeFilter === "graduated"
								? graduatedTokens.length.toString()
								: "—"
						}
					/>
				</motion.div> */}

				{/* Main Content Grid */}
				<div className="grid  gap-4 sm:gap-6">
					{/* Left Column - Token Grid */}
					<div>
						{/* Filter & Search Bar */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.2 }}
							className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6"
						>
							{/* Filter Tabs */}
							<div className="w-full sm:w-auto overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
								<div className="flex bg-card/60 backdrop-blur-md p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-border/60 w-max">
									{FILTER_TABS.map((tab) => {
										const Icon = tab.icon;
										const isActive =
											activeFilter === tab.id;
										return (
											<button
												key={tab.id}
												onClick={() =>
													setActiveFilter(tab.id)
												}
												className={cn(
													"relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[11px] sm:text-sm font-medium transition-all whitespace-nowrap",
													isActive
														? "text-primary-foreground"
														: "text-muted-foreground hover:text-foreground",
												)}
											>
												{isActive && (
													<motion.div
														layoutId="activeFilter"
														className="absolute inset-0 bg-primary rounded-md sm:rounded-lg"
														transition={{
															type: "spring",
															bounce: 0.2,
															duration: 0.5,
														}}
													/>
												)}
												<span className="relative z-10 flex items-center gap-1 sm:gap-1.5">
													<Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
													{tab.label}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							{/* Search + View Toggle */}
							<div className="flex items-center gap-2 w-full sm:w-auto">
								<div className="relative flex-1 sm:w-64 sm:flex-none">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
									<Input
										placeholder="Search tokens..."
										value={searchQuery}
										onChange={(e) =>
											setSearchQuery(e.target.value)
										}
										className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm bg-card/60 border-border/50 focus:border-primary/50"
									/>
								</div>
								
								{/* View Toggle */}
								<div className="flex bg-card/60 backdrop-blur-md p-0.5 rounded-lg border border-border/60 shrink-0">
									<button
										onClick={() => setViewMode('grid')}
										className={cn(
											"p-1.5 sm:p-2 rounded-md transition-all",
											viewMode === 'grid'
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground"
										)}
										title="Grid view"
									>
										<LayoutGrid className="w-4 h-4" />
									</button>
									<button
										onClick={() => setViewMode('list')}
										className={cn(
											"p-1.5 sm:p-2 rounded-md transition-all",
											viewMode === 'list'
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground"
										)}
										title="List view"
									>
										<List className="w-4 h-4" />
									</button>
								</div>
							</div>
						</motion.div>

						{/* Token Grid/List */}
						<AnimatePresence mode="wait">
							{isLoading ? (
								<motion.div
									key="loading"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
								>
									{Array.from({ length: 12 }).map((_, i) => (
										<div
											key={i}
											className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex gap-3"
										>
											{/* Square image skeleton */}
											<Skeleton className="w-[88px] h-[88px] rounded-lg shrink-0" />
											{/* Content */}
											<div className="flex-1 min-w-0 flex flex-col gap-1.5">
												{/* Row 1: Name + Progress bar */}
												<div className="flex items-center justify-between gap-2">
													<Skeleton className="h-4 w-24" />
													<Skeleton className="h-[10px] w-[150px] rounded-full" />
												</div>
												{/* Row 2: Symbol */}
												<Skeleton className="h-3.5 w-12" />
												{/* Row 3: Creator + Time */}
												<Skeleton className="h-3 w-32" />
												{/* Row 4: MC + Price Change */}
												<div className="flex items-center justify-between gap-2">
													<Skeleton className="h-4 w-20" />
													<Skeleton className="h-3.5 w-14" />
												</div>
												{/* Row 5: Description */}
												<Skeleton className="h-3 w-full" />
											</div>
										</div>
									))}
								</motion.div>
							) : filteredTokens.length === 0 ? (
								<motion.div
									key="empty"
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="flex flex-col items-center justify-center py-10 sm:py-16 text-center"
								>
									<div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-3 sm:mb-4">
										<Search className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
									</div>
									<h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">
										No tokens found
									</h3>
									<p className="text-muted-foreground text-xs sm:text-sm max-w-sm mb-3 sm:mb-4 px-4">
										{searchQuery
											? `No tokens match "${searchQuery}"`
											: "Be the first to launch a token!"}
									</p>
									<Link href="/create">
										<Button
											variant="outline"
											className="gap-1.5 sm:gap-2 text-sm h-9"
										>
											<Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
											Create Token
										</Button>
									</Link>
								</motion.div>
							) : viewMode === 'grid' ? (
								<motion.div
									key="grid"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
								>
									{filteredTokens.map((token, index) => (
										<motion.div
											key={token.id}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												delay: index * 0.03,
												duration: 0.3,
											}}
										>
											<TokenCard
												token={token}
												className="h-full bg-card/40 hover:bg-card/70 border-border/50 hover:border-primary/30 transition-all duration-200"
											/>
										</motion.div>
									))}
								</motion.div>
							) : (
								<motion.div
									key="list"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="w-full overflow-x-auto"
								>
									{/* List Header - Fixed min-width for horizontal scrolling */}
									<div className="flex items-center gap-3 px-4 py-2.5 text-[10px] text-[#666] font-medium uppercase border-b border-[#333] bg-[#0a0a0a] sticky top-0 z-10 min-w-[1200px]">
										{/* Coin header (2.5 parts) */}
										<div className="flex-[2.5] min-w-0">
											<span className="ml-14">Coin</span>
										</div>
										{/* Graph (1.5 parts) */}
										<div className="flex-[1.5] text-center">Graph</div>
										{/* MCAP (1 part) */}
										<div className="flex-1 text-right">MCap</div>
										{/* Age (0.5 part) */}
										<div className="flex-[0.5] text-center">Age</div>
										{/* TXNS (0.75 part) */}
										<div className="flex-[0.75] text-right">Txns</div>
										{/* 24H VOL (1 part) */}
										<div className="flex-1 text-right">24h Vol</div>
										{/* TRADERS (0.75 part) */}
										<div className="flex-[0.75] text-right">Traders</div>
										{/* 5M (0.75 part) */}
										<div className="flex-[0.75] text-right">5m</div>
										{/* 1H (0.75 part) */}
										<div className="flex-[0.75] text-right">1h</div>
										{/* 6H (0.75 part) */}
										<div className="flex-[0.75] text-right">6h</div>
										{/* 24H (0.75 part) */}
										<div className="flex-[0.75] text-right">24h</div>
										{/* Star (0.4 part) */}
										<div className="flex flex-[0.4] justify-center"></div>
									</div>
									{filteredTokens.map((token, index) => (
										<TokenListItem
											key={token.id}
											token={token}
											index={index}
										/>
									))}
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* Right Column - Activity Feed */}
					{/* <motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.3 }}
						className="hidden lg:block space-y-4"
					>
						<ActivityFeed items={activityFeed} />

						Quick Links
						<div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-4">
							<h3 className="text-sm font-medium mb-3">
								Quick Actions
							</h3>
							<div className="space-y-2">
								<Link href="/create" className="block">
									<Button
										variant="outline"
										className="w-full justify-start gap-2 h-10"
									>
										<Plus className="h-4 w-4" />
										Create New Token
									</Button>
								</Link>
								<Link href="/profile" className="block">
									<Button
										variant="ghost"
										className="w-full justify-start gap-2 h-10"
									>
										<BarChart3 className="h-4 w-4" />
										View Profile
									</Button>
								</Link>
							</div>
						</div>

						Tips
						<div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
							<div className="flex items-center gap-2 mb-2">
								<Sparkles className="h-4 w-4 text-primary" />
								<span className="text-sm font-medium">
									Pro Tip
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Enable HypeBoost when creating tokens to protect
								against bots and ensure fair distribution.
							</p>
						</div>
					</motion.div> */}
				</div>
			</div>
		</main>
	);
}

// Loading skeleton for Suspense fallback
function HomePageSkeleton() {
	return (
		<main className="min-h-screen pb-20">
			<div className="mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
				{/* Hero Section Skeleton */}
				<div className="mb-6 sm:mb-8">
					<Skeleton className="h-8 sm:h-10 md:h-12 w-48 sm:w-64 mb-2" />
					<Skeleton className="h-4 sm:h-5 w-64 sm:w-80" />
				</div>

				{/* Stats Row Skeleton */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="bg-card/40 border border-border/50 rounded-xl p-3 sm:p-4"
						>
							<div className="flex items-center gap-2 sm:gap-3">
								<Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-5 sm:h-7 w-12 sm:w-16" />
									<Skeleton className="h-2.5 sm:h-3 w-16 sm:w-20" />
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Main Content Grid */}
				<div className="grid lg:grid-cols-[1fr_300px] gap-4 sm:gap-6">
					{/* Left Column - Token Grid */}
					<div>
						{/* Filter & Search Bar Skeleton */}
						<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
							<Skeleton className="h-10 sm:h-11 w-full sm:w-80 rounded-lg sm:rounded-xl" />
							<Skeleton className="h-9 sm:h-10 w-full sm:w-64 rounded-lg" />
						</div>

						{/* Token Grid Skeleton */}
						<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
							{Array.from({ length: 9 }).map((_, i) => (
								<div
									key={i}
									className="bg-card/40 border border-border/50 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3"
								>
									<div className="flex items-center gap-2 sm:gap-3">
										<Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg" />
										<div className="flex-1 space-y-1.5 sm:space-y-2">
											<Skeleton className="h-3 sm:h-4 w-20 sm:w-24" />
											<Skeleton className="h-2.5 sm:h-3 w-14 sm:w-16" />
										</div>
									</div>
									<Skeleton className="h-6 sm:h-8 w-full" />
									<div className="flex justify-between">
										<Skeleton className="h-3 sm:h-4 w-14 sm:w-16" />
										<Skeleton className="h-3 sm:h-4 w-14 sm:w-16" />
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Right Column - Activity Feed Skeleton */}
					<div className="hidden lg:block space-y-4">
						{/* Activity Feed Skeleton */}
						<div className="bg-card/40 border border-border/50 rounded-xl p-4">
							<div className="flex items-center gap-2 mb-3">
								<Skeleton className="h-4 w-4 rounded" />
								<Skeleton className="h-4 w-24" />
							</div>
							<div className="space-y-3">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="flex items-center gap-3 py-2"
									>
										<Skeleton className="w-8 h-8 rounded-lg shrink-0" />
										<div className="flex-1 space-y-1.5">
											<Skeleton className="h-3.5 w-full" />
											<Skeleton className="h-2.5 w-16" />
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Quick Actions Skeleton */}
						<div className="bg-card/40 border border-border/50 rounded-xl p-4">
							<Skeleton className="h-4 w-28 mb-3" />
							<div className="space-y-2">
								<Skeleton className="h-10 w-full rounded-lg" />
								<Skeleton className="h-10 w-full rounded-lg" />
							</div>
						</div>

						{/* Tips Skeleton */}
						<div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
							<div className="flex items-center gap-2 mb-2">
								<Skeleton className="h-4 w-4 rounded" />
								<Skeleton className="h-4 w-16" />
							</div>
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-3/4 mt-1" />
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

// Wrapper component with Suspense for useSearchParams
export default function HomePageWrapper() {
	return (
		<Suspense fallback={<HomePageSkeleton />}>
			<HomePage />
		</Suspense>
	);
}
