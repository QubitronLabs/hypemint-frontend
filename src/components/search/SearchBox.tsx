"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Search,
	X,
	Clock,
	ArrowRight,
	AlertCircle,
	Command as CommandIcon,
} from "lucide-react";
import {
	Command,
	CommandInput,
	CommandList,
	CommandGroup,
	CommandItem,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenImage } from "@/components/ui/token-image";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import {
	formatRelativeTime,
	formatCompactMarketCap,
	formatTimeAgo,
} from "@/lib/formatters";
import { safeLocalStorage } from "@/lib/utils/safe-storage";
import { searchTokens } from "@/lib/api/tokens";
import type { SearchResults, SearchUser } from "@/lib/api/tokens";
import type { Token } from "@/types";
import { User, BadgeCheck } from "lucide-react";

// ─── Storage Keys ───────────────────────────────────────────
const RECENT_SEARCHES_KEY = "hypemint_recent_searches";
const RECENT_VIEWED_KEY = "hypemint_recent_viewed";
const RECENT_VIEWED_USERS_KEY = "hypemint_recent_viewed_users";
const MAX_RECENT_SEARCHES = 10;
const MAX_RECENT_VIEWED = 10;
const MAX_RECENT_VIEWED_USERS = 10;

// ─── Types ──────────────────────────────────────────────────
interface RecentViewedToken {
	id: string;
	name: string;
	symbol: string;
	imageUrl?: string;
	description?: string;
	marketCap: string;
	viewedAt: number;
}

interface SearchBoxConfig {
	searchFn?: (
		query: string,
		options?: { limit?: number },
	) => Promise<SearchResults>;
	pageSize?: number;
	debounceDelay?: number;
	placeholder?: string;
}

interface SearchBoxProps {
	config?: SearchBoxConfig;
	className?: string;
}

// ─── Local Storage Helpers ──────────────────────────────────
function getRecentSearches(): string[] {
	const data = safeLocalStorage.getItem(RECENT_SEARCHES_KEY);
	if (!data) return [];
	try {
		return JSON.parse(data);
	} catch {
		return [];
	}
}

function saveRecentSearches(searches: string[]) {
	safeLocalStorage.setItem(
		RECENT_SEARCHES_KEY,
		JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)),
	);
}

function addRecentSearch(query: string) {
	const searches = getRecentSearches().filter((s) => s !== query);
	searches.unshift(query);
	saveRecentSearches(searches);
}

function clearRecentSearches() {
	safeLocalStorage.removeItem(RECENT_SEARCHES_KEY);
}

function getRecentViewed(): RecentViewedToken[] {
	const data = safeLocalStorage.getItem(RECENT_VIEWED_KEY);
	if (!data) return [];
	try {
		return JSON.parse(data);
	} catch {
		return [];
	}
}

function saveRecentViewed(tokens: RecentViewedToken[]) {
	safeLocalStorage.setItem(
		RECENT_VIEWED_KEY,
		JSON.stringify(tokens.slice(0, MAX_RECENT_VIEWED)),
	);
}

export function addRecentViewed(token: Token) {
	const viewed = getRecentViewed().filter((t) => t.id !== token.id);
	viewed.unshift({
		id: token.id,
		name: token.name,
		symbol: token.symbol,
		imageUrl: token.imageUrl,
		description: token.description,
		marketCap: token.marketCapUsd || token.marketCap,
		viewedAt: Date.now(),
	});
	saveRecentViewed(viewed);
}

function clearRecentViewed() {
	safeLocalStorage.removeItem(RECENT_VIEWED_KEY);
}

// ─── Recently Viewed Users Storage ──────────────────────────
interface RecentViewedUser {
	id: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	walletAddress: string;
	isVerified: boolean;
	viewedAt: number;
}

function getRecentViewedUsers(): RecentViewedUser[] {
	const data = safeLocalStorage.getItem(RECENT_VIEWED_USERS_KEY);
	if (!data) return [];
	try {
		return JSON.parse(data);
	} catch {
		return [];
	}
}

function saveRecentViewedUsers(users: RecentViewedUser[]) {
	safeLocalStorage.setItem(
		RECENT_VIEWED_USERS_KEY,
		JSON.stringify(users.slice(0, MAX_RECENT_VIEWED_USERS)),
	);
}

export function addRecentViewedUser(user: {
	id: string;
	username?: string | null;
	displayName?: string | null;
	avatarUrl?: string | null;
	walletAddress: string;
	isVerified?: boolean;
}) {
	const viewed = getRecentViewedUsers().filter((u) => u.id !== user.id);
	viewed.unshift({
		id: user.id,
		username: user.username ?? null,
		displayName: user.displayName ?? null,
		avatarUrl: user.avatarUrl ?? null,
		walletAddress: user.walletAddress,
		isVerified: user.isVerified ?? false,
		viewedAt: Date.now(),
	});
	saveRecentViewedUsers(viewed);
}

function clearRecentViewedUsers() {
	safeLocalStorage.removeItem(RECENT_VIEWED_USERS_KEY);
}

// ─── Component ──────────────────────────────────────────────
export function SearchBox({ config, className }: SearchBoxProps) {
	const {
		searchFn = searchTokens,
		pageSize = 10,
		debounceDelay = 300,
		placeholder = "Search for tokens...",
	} = config ?? {};

	const router = useRouter();
	const searchParams = useSearchParams();

	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [results, setResults] = useState<SearchResults>({ tokens: [], users: [] });
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [recentSearches, setRecentSearches] = useState<string[]>([]);
	const [recentViewed, setRecentViewed] = useState<RecentViewedToken[]>([]);
	const [recentViewedUsers, setRecentViewedUsers] = useState<RecentViewedUser[]>([]);

	// ─── Open / Close handlers ────────────────────────────────
	const handleOpen = useCallback(() => {
		setOpen(true);
		setQuery("");
		setDebouncedQuery("");
		setResults({ tokens: [], users: [] });
		setSearchError(null);
		setRecentSearches(getRecentSearches());
		setRecentViewed(getRecentViewed());
		setRecentViewedUsers(getRecentViewedUsers());
	}, []);

	const handleClose = useCallback(() => {
		setOpen(false);
		setQuery("");
		setDebouncedQuery("");
		setResults({ tokens: [], users: [] });
		setSearchError(null);
	}, []);

	// ─── Keyboard shortcut (Ctrl/Cmd + K) ────────────────────
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				if (open) handleClose();
				else handleOpen();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, handleOpen, handleClose]);

	// ─── Debounce query ──────────────────────────────────────
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query.trim());
		}, debounceDelay);
		return () => clearTimeout(timer);
	}, [query, debounceDelay]);

	// ─── Search API call ─────────────────────────────────────
	useEffect(() => {
		if (!debouncedQuery || debouncedQuery.length < 2) {
			setResults({ tokens: [], users: [] });
			setIsSearching(false);
			setSearchError(null);
			return;
		}

		let cancelled = false;
		setIsSearching(true);
		setSearchError(null);

		searchFn(debouncedQuery, { limit: pageSize })
			.then((data) => {
				if (!cancelled) {
					setResults(data);
					setIsSearching(false);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setSearchError("Failed to search. Please try again.");
					setIsSearching(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [debouncedQuery, searchFn, pageSize]);

	// ─── Navigate to token ───────────────────────────────────
	const handleSelectToken = useCallback(
		(token: Token) => {
			addRecentSearch(query);
			addRecentViewed(token);
			handleClose();
			router.push(`/token/${token.id}`);
		},
		[query, router, handleClose],
	);

	// ─── View all results ────────────────────────────────────
	const handleViewAll = useCallback(() => {
		if (query.trim()) {
			addRecentSearch(query.trim());
			handleClose();
			const params = new URLSearchParams(searchParams.toString());
			params.set("q", query.trim());
			params.delete("page");
			router.push(`/?${params.toString()}`);
		}
	}, [query, searchParams, router, handleClose]);

	// ─── Click a recent search keyword ───────────────────────
	const handleRecentSearchClick = useCallback((keyword: string) => {
		setQuery(keyword);
	}, []);

	// ─── Clear handlers ──────────────────────────────────────
	const handleClearSearches = useCallback(() => {
		clearRecentSearches();
		setRecentSearches([]);
	}, []);

	const handleClearViewed = useCallback(() => {
		clearRecentViewed();
		setRecentViewed([]);
	}, []);

	const handleClearViewedUsers = useCallback(() => {
		clearRecentViewedUsers();
		setRecentViewedUsers([]);
	}, []);

	// ─── Retry search ────────────────────────────────────────
	const handleRetry = useCallback(() => {
		setSearchError(null);
		setDebouncedQuery("");
		setTimeout(() => setDebouncedQuery(query.trim()), 50);
	}, [query]);

	// ─── Determine which view to show ────────────────────────
	const hasQuery = debouncedQuery.length >= 2;
	const hasResults = results.tokens.length > 0 || results.users.length > 0;
	const showResults =
		hasQuery && !isSearching && !searchError && hasResults;
	const showEmpty =
		hasQuery && !isSearching && !searchError && !hasResults;
	const showLoading = hasQuery && isSearching;
	const showError = hasQuery && !!searchError;
	const showRecent = !hasQuery;

	// Memoize recent section heading with clear button
	const recentSearchHeading = useMemo(
		() => (
			<div className="flex items-center justify-between w-full">
				<span>Recently Searched</span>
				<button
					onClick={(e) => {
						e.stopPropagation();
						handleClearSearches();
					}}
					className="text-[11px] text-primary hover:text-primary/80 transition-colors font-normal normal-case tracking-normal"
				>
					Clear
				</button>
			</div>
		),
		[handleClearSearches],
	);

	const recentViewedHeading = useMemo(
		() => (
			<div className="flex items-center justify-between w-full">
				<span>Recently Viewed</span>
				<button
					onClick={(e) => {
						e.stopPropagation();
						handleClearViewed();
					}}
					className="text-[11px] text-primary hover:text-primary/80 transition-colors font-normal normal-case tracking-normal"
				>
					Clear
				</button>
			</div>
		),
		[handleClearViewed],
	);

	const recentViewedUsersHeading = useMemo(
		() => (
			<div className="flex items-center justify-between w-full">
				<span>Recently Viewed Users</span>
				<button
					onClick={(e) => {
						e.stopPropagation();
						handleClearViewedUsers();
					}}
					className="text-[11px] text-primary hover:text-primary/80 transition-colors font-normal normal-case tracking-normal"
				>
					Clear
				</button>
			</div>
		),
		[handleClearViewedUsers],
	);

	return (
		<>
			{/* Trigger Button */}
			<Button
				variant="outline"
				onClick={handleOpen}
				className={cn(
					"relative flex items-center gap-2 w-full max-w-lg h-9 md:h-11 px-3 md:px-4 rounded-xl",
					"justify-start font-normal text-muted-foreground",
					"bg-muted/50 border-border/50 hover:bg-muted/80 hover:border-primary/30",
					"transition-all duration-200",
					className,
				)}
			>
				<Search className="h-4 w-4 shrink-0" />
				<span className="flex-1 text-left truncate text-sm">
					Search tokens...
				</span>
				<div className="hidden md:flex items-center gap-0.5 text-muted-foreground/50 shrink-0">
					<kbd className="flex items-center text-[10px] bg-background/80 px-1.5 py-0.5 rounded-md border border-border/50">
						<CommandIcon className="h-2.5 w-2.5" />K
					</kbd>
				</div>
			</Button>

			{/* Search Dialog with Command */}
			<Dialog
				open={open}
				onOpenChange={(val) => (val ? handleOpen() : handleClose())}
			>
				<DialogContent
					className="sm:max-w-[600px] p-0 gap-0 bg-[#0c0c0c] border-[#2a2a2a] overflow-hidden"
					showCloseButton={false}
				>
					<DialogHeader className="sr-only">
						<DialogTitle>Search Tokens</DialogTitle>
						<DialogDescription>
							Search for tokens by name or symbol
						</DialogDescription>
					</DialogHeader>

					<Command
						shouldFilter={false}
						className="bg-[#0c0c0c] [&_[cmdk-group-heading]]:text-white/60"
					>
						{/* Search Input */}
						<div className="relative">
							<CommandInput
								value={query}
								onValueChange={(val) => setQuery(val)}
								placeholder={placeholder}
								className="pr-10"
							/>
							{query && (
								<button
									onClick={() => {
										setQuery("");
										setDebouncedQuery("");
									setResults({ tokens: [], users: [] });
									}}
									className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent/50 text-muted-foreground z-10"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							)}
						</div>

						{/* Fixed-height scrollable content area */}
						<CommandList className="min-h-[400px] max-h-[60vh] [&>[cmdk-list-sizer]]:min-h-[400px]">

							{/* ─── Loading Skeleton ─── */}
							{showLoading && (
								<div className="p-4 space-y-3">
									<Skeleton className="h-3 w-20 mb-2" />
									{Array.from({ length: 6 }).map((_, i) => (
										<div
											key={i}
											className="flex items-center gap-3 py-2"
										>
											<Skeleton className="w-9 h-9 rounded-full shrink-0" />
											<div className="flex-1 space-y-1.5">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-24" />
											</div>
											<div className="text-right space-y-1">
												<Skeleton className="h-4 w-16 ml-auto" />
												<Skeleton className="h-3 w-12 ml-auto" />
											</div>
										</div>
									))}
								</div>
							)}

							{/* ─── Error State ─── */}
							{showError && (
								<div className="absolute flex flex-col items-center left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 justify-center py-10 text-center px-4">
									<AlertCircle className="h-8 w-8 text-destructive mb-3" />
									<p className="text-sm text-muted-foreground mb-3">
										{searchError}
									</p>
									<Button
										size="sm"
										onClick={handleRetry}
										className="bg-primary text-primary-foreground hover:bg-primary/90"
									>
										Retry
									</Button>
								</div>
							)}

							{/* ─── Empty State ─── */}
							{showEmpty && (
								<div className="absolute flex flex-col items-center left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 justify-center py-10 text-center px-4">
									<Search className="h-8 w-8 text-muted-foreground mb-3" />
									<p className="text-sm text-muted-foreground">
										No results found for &quot;
										{debouncedQuery}&quot;
									</p>
								</div>
							)}

							{/* ─── Search Results: Coins ─── */}
							{showResults && results.tokens.length > 0 && (
								<CommandGroup heading="Coins">
									{results.tokens.map((token) => (
										<CommandItem
											key={token.id}
											value={token.id}
											onSelect={() =>
												handleSelectToken(token)
											}
											className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1a1a1a] data-[selected=true]:bg-[#1a1a1a]"
										>
											<TokenImage
												src={token.imageUrl}
												alt={token.name}
												symbol={token.symbol}
												size={36}
												className="rounded-full w-9 h-9 shrink-0"
											/>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5">
													<span className="font-semibold text-sm text-white truncate">
														{token.symbol}
													</span>
													<span className="text-xs text-white/50 truncate">
														{token.name}
													</span>
												</div>
												{token.contractAddress && (
													<span className="text-[11px] text-white/30 truncate block">
														{token.contractAddress.slice(
															0,
															6,
														)}
														...
														{token.contractAddress.slice(
															-4,
														)}
													</span>
												)}
											</div>
											<div className="text-right shrink-0">
												<span className="text-sm font-semibold text-white block">
													{formatCompactMarketCap(
														token.marketCap,
													)}
												</span>
												{token.createdAt && (
													<span className="text-[11px] text-white/40">
														↳{" "}
														{formatRelativeTime(
															new Date(
																token.createdAt,
															),
														)}
													</span>
												)}
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							)}

							{/* ─── Search Results: Users ─── */}
							{showResults && results.users.length > 0 && (
								<>
									{results.tokens.length > 0 && <CommandSeparator />}
									<CommandGroup heading="Users">
										{results.users.map((user) => (
											<CommandItem
												key={user.id}
												value={`user-${user.id}`}
												onSelect={() => {
													addRecentSearch(query);
													addRecentViewedUser(user);
													handleClose();
													router.push(`/user/${user.walletAddress}`);
												}}
												className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1a1a1a] data-[selected=true]:bg-[#1a1a1a]"
											>
											<UserAvatar
												userId={user.id}
												avatarUrl={user.avatarUrl}
												username={user.username || user.displayName || undefined}
												sizeClassName="size-9"
												className="shrink-0"
											/>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-1.5">
														<span className="font-semibold text-sm text-white truncate">
															{user.displayName || user.username || "Anonymous"}
														</span>
														{user.isVerified && (
															<BadgeCheck className="h-3.5 w-3.5 text-[#00ff88] shrink-0" />
														)}
													</div>
													{user.username && (
														<span className="text-[11px] text-white/40 truncate block">
															@{user.username}
														</span>
													)}
												</div>
												<div className="text-right shrink-0 text-[11px] text-white/40 space-y-0.5">
													{user.followersCount > 0 && (
														<span className="block">{user.followersCount} followers</span>
													)}
													{user.tokensCreated > 0 && (
														<span className="block">{user.tokensCreated} tokens</span>
													)}
												</div>
											</CommandItem>
										))}
									</CommandGroup>
								</>
							)}

							{/* ─── View All Results (bottom) ─── */}
							{showResults && (
								<CommandItem
									onSelect={handleViewAll}
									className="flex items-center justify-center gap-2 py-2.5 text-[#00ff88] border-t border-[#2a2a2a] rounded-none hover:bg-[#1a1a1a] mt-1"
								>
									View all results{" "}
									<ArrowRight className="h-3.5 w-3.5" />
								</CommandItem>
							)}

							{/* ─── Recent Content (No query) ─── */}
							{showRecent && (
								<>
									{/* Recently Searched Keywords */}
									{recentSearches.length > 0 && (
										<CommandGroup
											heading={recentSearchHeading}
										>
											{recentSearches.map((keyword) => (
												<CommandItem
													key={keyword}
													value={`search-${keyword}`}
													onSelect={() =>
														handleRecentSearchClick(
															keyword,
														)
													}
													className="flex items-center gap-3 cursor-pointer"
												>
													<Search className="h-4 w-4 text-white/40 shrink-0" />
													<span className="text-sm text-white/80">
														{keyword}
													</span>
												</CommandItem>
											))}
										</CommandGroup>
									)}

									{/* Separator between recent groups */}
									{recentSearches.length > 0 &&
										recentViewed.length > 0 && (
											<CommandSeparator />
										)}

									{/* Recently Viewed Tokens */}
									{recentViewed.length > 0 && (
										<CommandGroup
											heading={recentViewedHeading}
										>
											{recentViewed.map((token) => (
												<CommandItem
													key={token.id}
													value={`viewed-${token.id}`}
													onSelect={() => {
														handleClose();
														router.push(
															`/token/${token.id}`,
														);
													}}
													className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-[#1a1a1a] data-[selected=true]:bg-[#1a1a1a]"
												>
													<TokenImage
														src={token.imageUrl}
														alt={token.name}
														symbol={token.symbol}
														size={36}
														className="rounded-full w-9 h-9 shrink-0"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="font-semibold text-sm text-white truncate">
																{token.symbol}
															</span>
															<span className="text-xs text-white/50 truncate">
																{token.name}
															</span>
														</div>
													</div>
													<div className="text-right shrink-0">
														<span className="text-sm font-semibold text-white block">
															{formatCompactMarketCap(
															token.marketCapUsd || token.marketCap,
															)}
														</span>
														<span className="text-[11px] text-white/40">
															↳{" "}
															{formatTimeAgo(
																token.viewedAt,
															)}
														</span>
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									)}

									{/* Separator before recently viewed users */}
									{(recentSearches.length > 0 || recentViewed.length > 0) &&
										recentViewedUsers.length > 0 && (
											<CommandSeparator />
										)}

									{/* Recently Viewed Users */}
									{recentViewedUsers.length > 0 && (
										<CommandGroup
											heading={recentViewedUsersHeading}
										>
											{recentViewedUsers.map((user) => (
												<CommandItem
													key={user.id}
													value={`viewed-user-${user.id}`}
													onSelect={() => {
														handleClose();
														router.push(
															`/user/${user.walletAddress}`,
														);
													}}
													className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-[#1a1a1a] data-[selected=true]:bg-[#1a1a1a]"
												>
													<UserAvatar
														userId={user.id}
														avatarUrl={user.avatarUrl}
														username={user.username || user.displayName || undefined}
														sizeClassName="size-9"
														className="shrink-0"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="font-semibold text-sm text-white truncate">
																{user.displayName || user.username || "Anonymous"}
															</span>
															{user.isVerified && (
																<BadgeCheck className="h-3.5 w-3.5 text-[#00ff88] shrink-0" />
															)}
														</div>
														{user.username && (
															<span className="text-[11px] text-white/40 truncate block">
																@{user.username}
															</span>
														)}
													</div>
													<div className="text-right shrink-0">
														<span className="text-[11px] text-white/40">
															↳{" "}
															{formatTimeAgo(
																user.viewedAt,
															)}
														</span>
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									)}

									{/* Empty recent state — centered both ways */}
									{recentSearches.length === 0 &&
										recentViewed.length === 0 &&
										recentViewedUsers.length === 0 && (
											<div className="flex flex-col items-center justify-center text-center px-4 min-h-[380px]">
												<Clock className="h-8 w-8 text-white/20 mb-3" />
												<p className="text-sm text-white/50">
													No recent activity
												</p>
												<p className="text-xs text-white/30 mt-1">
													Search for tokens to get
													started
												</p>
											</div>
										)}
								</>
							)}
						</CommandList>

						{/* Footer */}
						<div className="flex items-center justify-between px-4 py-2 border-t border-[#2a2a2a] text-[11px] text-white/40">
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-white/50">
										↵
									</kbd>
									to select
								</span>
								<span className="flex items-center gap-1">
									<kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-white/50">
										↑↓
									</kbd>
									to navigate
								</span>
								<span className="flex items-center gap-1">
									<kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-white/50">
										esc
									</kbd>
									to close
								</span>
							</div>
							<kbd className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] text-white/50">
								⌘K
							</kbd>
						</div>
					</Command>
				</DialogContent>
			</Dialog>
		</>
	);
}
