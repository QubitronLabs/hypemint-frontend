"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
	Zap,
	BarChart3,
	Sparkles,
	Flame,
	Trophy,
	Plus,
	LayoutGrid,
	List,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Search,
	AlertCircle,
	RefreshCw,
	SlidersHorizontal,
	X,
	Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { TokenCard, TokenListItem } from "@/components/token";
import { TrendingCarousel } from "@/components/token/TrendingCarousel";
import {
	useTrendingTokens,
	useNewTokens,
	useTokens,
	useLiveTokens,
	useGraduatedTokens,
	tokenKeys,
} from "@/hooks/useTokens";
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

const PAGE_SIZE = 40;

// Valid tabs array for the persisted tabs hook
const VALID_TABS: readonly FilterTab[] = [
	"all",
	"trending",
	"new",
	"live",
	"graduated",
] as const;

// Activity feed item interface (for WebSocket)
interface ActivityItem {
	id: string;
	type: "new_token" | "trade";
	tokenSymbol: string;
	tokenName?: string;
	message: string;
	timestamp: number;
}

// ─── Filter Constants ─────────────────────────────────────
const MCAP_MIN = 1000;
const MCAP_MAX = 50000000;
const VOL_MIN = 0;
const VOL_MAX = 500000;

function formatFilterValue(v: number): string {
	if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
	if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
	return `$${v}`;
}

function parseFilterInput(val: string): number {
	const cleaned = val.replace(/[^0-9.kmb]/gi, "");
	const match = cleaned.match(/^([\d.]+)\s*(k|m|b)?$/i);
	if (!match) return NaN;
	const num = parseFloat(match[1]);
	const suffix = (match[2] || "").toLowerCase();
	if (suffix === "k") return num * 1000;
	if (suffix === "m") return num * 1000000;
	if (suffix === "b") return num * 1000000000;
	return num;
}

// ─── Token Filter Panel Component ─────────────────────────
interface TokenFilterPanelProps {
	appliedMcap: [number, number] | null;
	appliedVol: [number, number] | null;
	onApply: (
		mcap: [number, number] | null,
		vol: [number, number] | null,
	) => void;
	onRemove: (type: "mcap" | "vol") => void;
}

function TokenFilterPanel({
	appliedMcap,
	appliedVol,
	onApply,
	onRemove,
}: TokenFilterPanelProps) {
	const [filterOpen, setFilterOpen] = useState(false);
	const [mcapRange, setMcapRange] = useState<[number, number]>(
		appliedMcap ?? [MCAP_MIN, MCAP_MAX],
	);
	const [volRange, setVolRange] = useState<[number, number]>(
		appliedVol ?? [VOL_MIN, VOL_MAX],
	);
	const [mcapMinInput, setMcapMinInput] = useState("");
	const [mcapMaxInput, setMcapMaxInput] = useState("");
	const [volMinInput, setVolMinInput] = useState("");
	const [volMaxInput, setVolMaxInput] = useState("");

	const activeFilterCount = (appliedMcap ? 1 : 0) + (appliedVol ? 1 : 0);

	const syncMcapInputs = (range: [number, number]) => {
		setMcapMinInput(
			range[0] <= MCAP_MIN
				? ""
				: formatFilterValue(range[0]).replace("$", ""),
		);
		setMcapMaxInput(
			range[1] >= MCAP_MAX
				? ""
				: formatFilterValue(range[1]).replace("$", ""),
		);
	};

	const syncVolInputs = (range: [number, number]) => {
		setVolMinInput(
			range[0] <= VOL_MIN
				? ""
				: formatFilterValue(range[0]).replace("$", ""),
		);
		setVolMaxInput(
			range[1] >= VOL_MAX
				? ""
				: formatFilterValue(range[1]).replace("$", ""),
		);
	};

	const handleApply = () => {
		const isMcapDefault =
			mcapRange[0] <= MCAP_MIN && mcapRange[1] >= MCAP_MAX;
		const isVolDefault = volRange[0] <= VOL_MIN && volRange[1] >= VOL_MAX;
		onApply(
			isMcapDefault ? null : [...mcapRange],
			isVolDefault ? null : [...volRange],
		);
		setFilterOpen(false);
	};

	const handleClear = () => {
		setMcapRange([MCAP_MIN, MCAP_MAX]);
		setVolRange([VOL_MIN, VOL_MAX]);
		setMcapMinInput("");
		setMcapMaxInput("");
		setVolMinInput("");
		setVolMaxInput("");
		onApply(null, null);
		setFilterOpen(false);
	};

	return (
		<>
			{/* Active Filter Pills */}
			{appliedMcap && (
				<button
					onClick={() => onRemove("mcap")}
					className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all"
				>
					<span>
						MCap: {formatFilterValue(appliedMcap[0])} -{" "}
						{formatFilterValue(appliedMcap[1])}
					</span>
					<X className="w-3 h-3" />
				</button>
			)}
			{appliedVol && (
				<button
					onClick={() => onRemove("vol")}
					className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all"
				>
					<span>
						Vol: {formatFilterValue(appliedVol[0])} -{" "}
						{formatFilterValue(appliedVol[1])}
					</span>
					<X className="w-3 h-3" />
				</button>
			)}

			{/* Filter Popover */}
			<Popover open={filterOpen} onOpenChange={setFilterOpen}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border",
							activeFilterCount > 0
								? "bg-primary/10 border-primary/30 text-primary"
								: "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground",
						)}
					>
						{activeFilterCount > 0 ? (
							<>
								<span>Filtered {activeFilterCount}</span>
								<SlidersHorizontal className="w-3.5 h-3.5" />
							</>
						) : (
							<>
								<span>Filter</span>
								<SlidersHorizontal className="w-3.5 h-3.5" />
							</>
						)}
					</button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					className="w-[340px] sm:w-[400px] p-4 bg-card border-border"
					sideOffset={8}
				>
					<div className="space-y-5">
						{/* Mcap Filter */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm font-semibold">
									Mcap
								</span>
								<span className="text-xs text-muted-foreground">
									{formatFilterValue(mcapRange[0])} -{" "}
									{formatFilterValue(mcapRange[1])}+
								</span>
							</div>
							<Slider
								value={mcapRange}
								min={MCAP_MIN}
								max={MCAP_MAX}
								step={1000}
								onValueChange={(val) => {
									const v = val as [number, number];
									setMcapRange(v);
									syncMcapInputs(v);
								}}
								className="w-full"
							/>
							<div className="flex items-center justify-between text-[11px] text-muted-foreground">
								<span>$1.0K</span>
								<span>$50.0M+</span>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="text-[11px] text-muted-foreground mb-1 block">
										Minimum
									</label>
									<Input
										placeholder="e.g., 10k, 1m"
										value={mcapMinInput}
										onChange={(e) => {
											setMcapMinInput(e.target.value);
											const parsed = parseFilterInput(
												e.target.value,
											);
											if (
												!isNaN(parsed) &&
												parsed >= MCAP_MIN &&
												parsed < mcapRange[1]
											) {
												setMcapRange([
													parsed,
													mcapRange[1],
												]);
											}
										}}
										className="h-8 text-xs bg-muted/50"
									/>
								</div>
								<div>
									<label className="text-[11px] text-muted-foreground mb-1 block">
										Maximum
									</label>
									<Input
										placeholder="e.g., 10k, 1m"
										value={mcapMaxInput}
										onChange={(e) => {
											setMcapMaxInput(e.target.value);
											const parsed = parseFilterInput(
												e.target.value,
											);
											if (
												!isNaN(parsed) &&
												parsed <= MCAP_MAX &&
												parsed > mcapRange[0]
											) {
												setMcapRange([
													mcapRange[0],
													parsed,
												]);
											}
										}}
										className="h-8 text-xs bg-muted/50"
									/>
								</div>
							</div>
						</div>

						{/* Volume Filter */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm font-semibold">
									24h Vol
								</span>
								<span className="text-xs text-muted-foreground">
									{formatFilterValue(volRange[0])} -{" "}
									{formatFilterValue(volRange[1])}+
								</span>
							</div>
							<Slider
								value={volRange}
								min={VOL_MIN}
								max={VOL_MAX}
								step={500}
								onValueChange={(val) => {
									const v = val as [number, number];
									setVolRange(v);
									syncVolInputs(v);
								}}
								className="w-full"
							/>
							<div className="flex items-center justify-between text-[11px] text-muted-foreground">
								<span>$0</span>
								<span>$500.0K+</span>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="text-[11px] text-muted-foreground mb-1 block">
										Minimum
									</label>
									<Input
										placeholder="e.g., 5k, 100k"
										value={volMinInput}
										onChange={(e) => {
											setVolMinInput(e.target.value);
											const parsed = parseFilterInput(
												e.target.value,
											);
											if (
												!isNaN(parsed) &&
												parsed >= VOL_MIN &&
												parsed < volRange[1]
											) {
												setVolRange([
													parsed,
													volRange[1],
												]);
											}
										}}
										className="h-8 text-xs bg-muted/50"
									/>
								</div>
								<div>
									<label className="text-[11px] text-muted-foreground mb-1 block">
										Maximum
									</label>
									<Input
										placeholder="e.g., 5k, 100k"
										value={volMaxInput}
										onChange={(e) => {
											setVolMaxInput(e.target.value);
											const parsed = parseFilterInput(
												e.target.value,
											);
											if (
												!isNaN(parsed) &&
												parsed <= VOL_MAX &&
												parsed > volRange[0]
											) {
												setVolRange([
													volRange[0],
													parsed,
												]);
											}
										}}
										className="h-8 text-xs bg-muted/50"
									/>
								</div>
							</div>
						</div>

						{/* Actions */}
						<div className="flex gap-3 pt-1">
							<Button
								variant="outline"
								className="flex-1 h-9"
								onClick={handleClear}
							>
								Clear
							</Button>
							<Button
								className="flex-1 h-9"
								onClick={handleApply}
							>
								Apply
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</>
	);
}

function HomePage() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// ─── URL-synced state ─────────────────────────────────────
	const activeFilter = (() => {
		const urlFilter = searchParams.get("filter");
		if (urlFilter && VALID_TABS.includes(urlFilter as FilterTab))
			return urlFilter as FilterTab;
		return "all" as FilterTab;
	})();

	const currentPage = (() => {
		const urlPage = parseInt(searchParams.get("page") || "1", 10);
		return isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
	})();

	const viewMode = (() => {
		const urlView = searchParams.get("view");
		return urlView === "list" ? ("list" as const) : ("grid" as const);
	})();

	const searchQuery = searchParams.get("q") || "";

	// ─── URL update helpers ───────────────────────────────────
	const updateParam = useCallback(
		(key: string, value: string | null) => {
			const params = new URLSearchParams(searchParams.toString());
			if (
				value === null ||
				value === "" ||
				(key === "filter" && value === "all") ||
				(key === "page" && value === "1") ||
				(key === "view" && value === "grid")
			) {
				params.delete(key);
			} else {
				params.set(key, value);
			}
			const newUrl = params.toString()
				? `${pathname}?${params.toString()}`
				: pathname;
			router.replace(newUrl, { scroll: false });
		},
		[searchParams, pathname, router],
	);

	const setActiveFilter = useCallback(
		(filter: FilterTab) => {
			const params = new URLSearchParams(searchParams.toString());
			// Reset page when changing filter
			params.delete("page");
			if (filter === "all") params.delete("filter");
			else params.set("filter", filter);
			const newUrl = params.toString()
				? `${pathname}?${params.toString()}`
				: pathname;
			router.replace(newUrl, { scroll: false });
		},
		[searchParams, pathname, router],
	);

	const setCurrentPage = useCallback(
		(page: number) => {
			updateParam("page", page.toString());
		},
		[updateParam],
	);

	const setViewMode = useCallback(
		(mode: "grid" | "list") => {
			updateParam("view", mode);
		},
		[updateParam],
	);

	// ─── Debounced filter state ──────────────────────────────
	const [debouncedFilter, setDebouncedFilter] =
		useState<FilterTab>(activeFilter);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setDebouncedFilter(activeFilter);
		}, 300);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [activeFilter]);

	const [mounted, setMounted] = useState(false);
	const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
	void activityFeed; // Collected from WebSocket events, available for future UI

	// ─── Filter state (managed here, UI delegated to TokenFilterPanel) ──
	const [appliedMcap, setAppliedMcap] = useState<[number, number] | null>(
		null,
	);
	const [appliedVol, setAppliedVol] = useState<[number, number] | null>(null);

	const handleFilterApply = useCallback(
		(mcap: [number, number] | null, vol: [number, number] | null) => {
			setAppliedMcap(mcap);
			setAppliedVol(vol);
		},
		[],
	);

	const handleFilterRemove = useCallback((type: "mcap" | "vol") => {
		if (type === "mcap") setAppliedMcap(null);
		else setAppliedVol(null);
	}, []);

	// Scroll to top when page changes
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, [currentPage]);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Query Client for cache updates
	const queryClient = useQueryClient();

	// ─── Fetch data based on active tab ──────────────────────
	const {
		data: allTokensResult,
		isLoading: allLoading,
		isError: allError,
		refetch: refetchAll,
	} = useTokens(
		{ page: currentPage, pageSize: PAGE_SIZE, ...(searchQuery ? {} : {}) },
		{ enabled: mounted && debouncedFilter === "all" },
	);
	const allTokens = allTokensResult?.data ?? [];
	const pagination = allTokensResult?.pagination;

	const {
		data: trendingTokens = [],
		isLoading: trendingLoading,
		isError: trendingError,
		refetch: refetchTrending,
	} = useTrendingTokens(
		{ pageSize: PAGE_SIZE },
		{ enabled: mounted && debouncedFilter === "trending" },
	);

	const {
		data: newTokens = [],
		isLoading: newLoading,
		isError: newError,
		refetch: refetchNew,
	} = useNewTokens(
		{ pageSize: PAGE_SIZE },
		{ enabled: mounted && debouncedFilter === "new" },
	);

	const {
		data: liveTokens = [],
		isLoading: liveLoading,
		isError: liveError,
		refetch: refetchLive,
	} = useLiveTokens(
		{ limit: PAGE_SIZE },
		{ enabled: mounted && debouncedFilter === "live" },
	);

	const {
		data: graduatedTokens = [],
		isLoading: graduatedLoading,
		isError: graduatedError,
		refetch: refetchGraduated,
	} = useGraduatedTokens(
		{ limit: PAGE_SIZE },
		{ enabled: mounted && debouncedFilter === "graduated" },
	);

	// ─── WebSocket: New tokens ───────────────────────────────
	useNewTokenFeed(
		useCallback(
			(newToken: any) => {
				const activity: ActivityItem = {
					id: `token-${newToken.tokenId}-${Date.now()}`,
					type: "new_token",
					tokenSymbol: newToken.symbol,
					tokenName: newToken.name,
					message: `${newToken.name} ($${newToken.symbol}) just launched!`,
					timestamp: Date.now(),
				};
				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

				const formattedToken: Token = {
					id: newToken.id || newToken.tokenId,
					name: newToken.name,
					symbol: newToken.symbol,
					imageUrl: newToken.imageUrl,
					description: newToken.description,
					creatorId: newToken.creatorId,
					creator: newToken.creator,
					chainId: newToken.chainId,
					status: "active",
					hypeBoostEnabled: newToken.hypeBoostEnabled || false,
					createdAt: newToken.createdAt || new Date().toISOString(),
					updatedAt: new Date().toISOString(),
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
					if (oldData.some((t: Token) => t.id === formattedToken.id))
						return oldData;
					return [formattedToken, ...oldData];
				};

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

	// ─── WebSocket: Trades ───────────────────────────────────
	useGlobalTradeFeed(
		useCallback(
			(trade) => {
				const activity: ActivityItem = {
					id: `trade-${trade.tradeId}-${Date.now()}`,
					type: "trade",
					tokenSymbol: trade.tokenSymbol,
					message: `${trade.username || "Someone"} ${trade.type === "buy" ? "bought" : "sold"} $${trade.tokenSymbol}`,
					timestamp: Date.now(),
				};
				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

				const updateTokenInCache = (oldData: any) => {
					if (!oldData || !Array.isArray(oldData)) return oldData;
					return oldData.map((token: Token) => {
						if (token.id === trade.tokenId) {
							return {
								...token,
								bondingCurveProgress:
									trade.bondingCurveProgress !== undefined
										? trade.bondingCurveProgress
										: token.bondingCurveProgress,
								athProgress:
									trade.athProgress !== undefined
										? trade.athProgress
										: token.athProgress,
								marketCap:
									trade.marketCap !== undefined
										? trade.marketCap
										: token.marketCap,
								currentPrice:
									trade.price !== undefined
										? trade.price
										: token.currentPrice,
							};
						}
						return token;
					});
				};

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
				);
				queryClient.setQueriesData(
					{ queryKey: tokenKeys.graduated({}) },
					updateTokenInCache,
				);
			},
			[queryClient],
		),
	);

	// ─── WebSocket: Graduations ──────────────────────────────
	useTokenGraduations(
		useCallback(
			(data) => {
				const activity: ActivityItem = {
					id: `graduation-${data.tokenId}-${Date.now()}`,
					type: "trade",
					tokenSymbol: data.symbol,
					message: `🎓 ${data.name} ($${data.symbol}) just GRADUATED!`,
					timestamp: Date.now(),
				};
				setActivityFeed((prev) => [activity, ...prev].slice(0, 20));

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

	// ─── Determine display tokens ────────────────────────────
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

	const isError = (() => {
		switch (activeFilter) {
			case "all":
				return allError;
			case "trending":
				return trendingError;
			case "new":
				return newError;
			case "live":
				return liveError;
			case "graduated":
				return graduatedError;
			default:
				return false;
		}
	})();

	const handleRetry = useCallback(() => {
		switch (activeFilter) {
			case "all":
				refetchAll();
				break;
			case "trending":
				refetchTrending();
				break;
			case "new":
				refetchNew();
				break;
			case "live":
				refetchLive();
				break;
			case "graduated":
				refetchGraduated();
				break;
		}
	}, [
		activeFilter,
		refetchAll,
		refetchTrending,
		refetchNew,
		refetchLive,
		refetchGraduated,
	]);

	// Filter by search query from URL
	const searchFilteredTokens = searchQuery
		? tokens.filter(
				(token: Token) =>
					token.name
						.toLowerCase()
						.includes(searchQuery.toLowerCase()) ||
					token.symbol
						.toLowerCase()
						.includes(searchQuery.toLowerCase()),
			)
		: tokens;

	// Apply client-side mcap + volume filters
	const filteredTokens = searchFilteredTokens.filter((token: Token) => {
		const mcap = parseFloat(token.marketCap || "0");
		const vol = parseFloat(token.volume24h || "0");
		if (appliedMcap && (mcap < appliedMcap[0] || mcap > appliedMcap[1]))
			return false;
		if (appliedVol && (vol < appliedVol[0] || vol > appliedVol[1]))
			return false;
		return true;
	});

	if (!mounted) return null;

	return (
		<main className="min-h-screen pb-20">
			<div className="mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
				{/* Trending Coins Carousel */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-6 sm:mb-8"
				>
					<TrendingCarousel />
				</motion.div>

				{/* Main Content */}
				<div className="grid gap-4 sm:gap-6">
					<div className="min-w-0">
						{/* Filter Tabs + View Toggle */}
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

							{/* View Toggle + Filters */}
							<div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
								<TokenFilterPanel
									appliedMcap={appliedMcap}
									appliedVol={appliedVol}
									onApply={handleFilterApply}
									onRemove={handleFilterRemove}
								/>

								{/* View Toggle */}
								<div className="flex bg-card/60 backdrop-blur-md p-0.5 rounded-lg border border-border/60 shrink-0">
									<button
										onClick={() => setViewMode("grid")}
										className={cn(
											"p-1.5 sm:p-2 rounded-md transition-all",
											viewMode === "grid"
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
										title="Grid view"
									>
										<LayoutGrid className="w-4 h-4" />
									</button>
									<button
										onClick={() => setViewMode("list")}
										className={cn(
											"p-1.5 sm:p-2 rounded-md transition-all",
											viewMode === "list"
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
										title="List view"
									>
										<List className="w-4 h-4" />
									</button>
								</div>

								{/* Settings icon */}
								<button
									className="p-1.5 sm:p-2 rounded-lg bg-card/60 border border-border/60 text-muted-foreground hover:text-foreground transition-all"
									title="Settings"
								>
									<Settings className="w-4 h-4" />
								</button>
							</div>
						</motion.div>

						{/* ─── Error State ─── */}
						{isError && !isLoading && (
							<Alert variant="destructive" className="mb-4">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription className="flex items-center justify-between">
									<span>
										Failed to load tokens. Please try again.
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleRetry}
										className="gap-1.5 ml-4"
									>
										<RefreshCw className="h-3.5 w-3.5" />
										Retry
									</Button>
								</AlertDescription>
							</Alert>
						)}

						{/* Token Grid/List */}
						<AnimatePresence mode="wait">
							{isLoading ? (
								viewMode === "grid" ? (
									<motion.div
										key="loading-grid"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
									>
										{Array.from({ length: PAGE_SIZE }).map(
											(_, i) => (
												<div
													key={i}
													className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex gap-3"
												>
													<Skeleton className="w-[88px] h-[88px] rounded-lg shrink-0" />
													<div className="flex-1 min-w-0 flex flex-col gap-1.5">
														<div className="flex items-center justify-between gap-2">
															<Skeleton className="h-4 w-24" />
															<Skeleton className="h-[10px] w-[150px] rounded-full" />
														</div>
														<Skeleton className="h-3.5 w-12" />
														<Skeleton className="h-3 w-32" />
														<div className="flex items-center justify-between gap-2">
															<Skeleton className="h-4 w-20" />
															<Skeleton className="h-3.5 w-14" />
														</div>
														<Skeleton className="h-3 w-full" />
													</div>
												</div>
											),
										)}
									</motion.div>
								) : (
									<motion.div
										key="loading-list"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="space-y-0"
									>
										<div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#333] bg-[#0a0a0a] min-w-[1200px]">
											<Skeleton className="h-3 w-full" />
										</div>
										{Array.from({ length: PAGE_SIZE }).map(
											(_, i) => (
												<div
													key={i}
													className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] min-w-[1200px]"
												>
													<Skeleton className="w-5 h-4 shrink-0" />
													<Skeleton className="w-8 h-8 rounded-lg shrink-0" />
													<div className="flex-[2.5] flex items-center gap-2">
														<Skeleton className="h-4 w-24" />
														<Skeleton className="h-3 w-12" />
													</div>
													<Skeleton className="flex-[1.5] h-8" />
													<Skeleton className="flex-1 h-4" />
													<Skeleton className="flex-[0.5] h-3 w-8" />
													<Skeleton className="flex-[0.75] h-4" />
													<Skeleton className="flex-1 h-4" />
													<Skeleton className="flex-[0.75] h-4" />
													<Skeleton className="flex-[0.75] h-3" />
													<Skeleton className="flex-[0.75] h-3" />
													<Skeleton className="flex-[0.75] h-3" />
													<Skeleton className="flex-[0.75] h-3" />
													<Skeleton className="flex-[0.4] h-4 w-4" />
												</div>
											),
										)}
									</motion.div>
								)
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
							) : viewMode === "grid" ? (
								<motion.div
									key="grid"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4"
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
									className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
								>
									{/* List Header */}
									<div className="flex items-center gap-3 px-4 py-2.5 text-[10px] text-[#666] font-medium uppercase border-b border-[#333] bg-[#0a0a0a] sticky top-0 z-10 min-w-[1200px]">
										<div className="flex-[2.5] min-w-0">
											<span className="ml-14">Coin</span>
										</div>
										<div className="flex-[1.5] text-center">
											Graph
										</div>
										<div className="flex-1 text-right">
											MCap
										</div>
										<div className="flex-[0.5] text-center">
											Age
										</div>
										<div className="flex-[0.75] text-right">
											Txns
										</div>
										<div className="flex-1 text-right">
											24h Vol
										</div>
										<div className="flex-[0.75] text-right">
											Traders
										</div>
										<div className="flex-[0.75] text-right">
											5m
										</div>
										<div className="flex-[0.75] text-right">
											1h
										</div>
										<div className="flex-[0.75] text-right">
											6h
										</div>
										<div className="flex-[0.75] text-right">
											24h
										</div>
										<div className="flex flex-[0.4] justify-center"></div>
									</div>
									{filteredTokens.map((token, index) => (
										<TokenListItem
											key={token.id}
											token={token}
											index={
												activeFilter === "all"
													? (currentPage - 1) *
															PAGE_SIZE +
														index
													: index
											}
										/>
									))}
								</motion.div>
							)}
						</AnimatePresence>

						{/* Pagination Controls */}
						{!isLoading &&
							pagination &&
							pagination.totalPages > 1 &&
							filteredTokens.length > 0 && (
								<div className="flex flex-col items-center gap-3 mt-8 pt-4 border-t border-border/30">
									<div className="flex items-center gap-1">
										<button
											onClick={() => setCurrentPage(1)}
											disabled={!pagination.hasPrev}
											className={cn(
												"p-1.5 rounded-md transition-all",
												pagination.hasPrev
													? "text-muted-foreground hover:text-foreground hover:bg-muted"
													: "text-muted-foreground/30 cursor-not-allowed",
											)}
											title="First page"
										>
											<ChevronsLeft className="w-4 h-4" />
										</button>
										<button
											onClick={() =>
												setCurrentPage(
													Math.max(
														1,
														currentPage - 1,
													),
												)
											}
											disabled={!pagination.hasPrev}
											className={cn(
												"p-1.5 rounded-md transition-all",
												pagination.hasPrev
													? "text-muted-foreground hover:text-foreground hover:bg-muted"
													: "text-muted-foreground/30 cursor-not-allowed",
											)}
											title="Previous page"
										>
											<ChevronLeft className="w-4 h-4" />
										</button>

										{(() => {
											const pages: number[] = [];
											const total = pagination.totalPages;
											const current = pagination.page;
											let start = Math.max(
												1,
												current - 2,
											);
											const end = Math.min(
												total,
												start + 4,
											);
											start = Math.max(1, end - 4);
											for (let i = start; i <= end; i++)
												pages.push(i);
											return pages.map((p) => (
												<button
													key={p}
													onClick={() =>
														setCurrentPage(p)
													}
													className={cn(
														"min-w-[32px] h-8 px-2 text-xs font-medium rounded-md transition-all",
														p === current
															? "bg-primary text-primary-foreground"
															: "text-muted-foreground hover:text-foreground hover:bg-muted",
													)}
												>
													{p}
												</button>
											));
										})()}

										<button
											onClick={() =>
												setCurrentPage(
													Math.min(
														pagination.totalPages,
														currentPage + 1,
													),
												)
											}
											disabled={!pagination.hasNext}
											className={cn(
												"p-1.5 rounded-md transition-all",
												pagination.hasNext
													? "text-muted-foreground hover:text-foreground hover:bg-muted"
													: "text-muted-foreground/30 cursor-not-allowed",
											)}
											title="Next page"
										>
											<ChevronRight className="w-4 h-4" />
										</button>
										<button
											onClick={() =>
												setCurrentPage(
													pagination.totalPages,
												)
											}
											disabled={!pagination.hasNext}
											className={cn(
												"p-1.5 rounded-md transition-all",
												pagination.hasNext
													? "text-muted-foreground hover:text-foreground hover:bg-muted"
													: "text-muted-foreground/30 cursor-not-allowed",
											)}
											title="Last page"
										>
											<ChevronsRight className="w-4 h-4" />
										</button>
									</div>
									<p className="text-xs text-muted-foreground">
										Showing{" "}
										{(pagination.page - 1) *
											pagination.pageSize +
											1}
										–
										{Math.min(
											pagination.page *
												pagination.pageSize,
											pagination.totalItems,
										)}{" "}
										of {pagination.totalItems} tokens
									</p>
								</div>
							)}
					</div>
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
				{/* Carousel Skeleton */}
				<div className="mb-6 sm:mb-8">
					<Skeleton className="h-7 w-40 mb-4" />
					<div className="flex gap-4 overflow-hidden">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="min-w-[200px] rounded-xl overflow-hidden"
							>
								<Skeleton className="h-[140px] w-[200px]" />
							</div>
						))}
					</div>
				</div>

				{/* Filter Tabs Skeleton */}
				<div className="flex justify-between items-center gap-4 mb-6">
					<Skeleton className="h-10 w-80 rounded-xl" />
					<Skeleton className="h-10 w-20 rounded-lg" />
				</div>

				{/* Token Grid Skeleton */}
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
					{Array.from({ length: 40 }).map((_, i) => (
						<div
							key={i}
							className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex gap-3"
						>
							<Skeleton className="w-[88px] h-[88px] rounded-lg shrink-0" />
							<div className="flex-1 min-w-0 flex flex-col gap-1.5">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-3.5 w-12" />
								<Skeleton className="h-3 w-32" />
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-3 w-full" />
							</div>
						</div>
					))}
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
