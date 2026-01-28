"use client";

/**
 * Creator Dashboard Component
 * Shows tokens created by the user, earnings, and analytics
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
// import { formatEther, type Address } from "viem";
import {
	Coins,
	TrendingUp,
	TrendingDown,
	Users,
	BarChart3,
	DollarSign,
	Plus,
	ExternalLink,
	Sparkles,
	Rocket,
	Clock,
	Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TokenImage } from "@/components/ui/token-image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks";
import { useMyTokens } from "@/hooks/useTokens";
import type { Token } from "@/types";

interface CreatorDashboardProps {
	className?: string;
}

interface TokenStats {
	totalVolume: number;
	totalTrades: number;
	totalHolders: number;
	estimatedEarnings: number;
}

// Format large numbers
function formatNumber(num: number): string {
	if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
	if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
	if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
	return num.toFixed(2);
}

// Format currency
function formatCurrency(num: number): string {
	return "$" + formatNumber(num);
}

export function CreatorDashboard({ className }: CreatorDashboardProps) {
	const { isAuthenticated, walletAddress } = useAuth();
	const [activeTab, setActiveTab] = useState("overview");

	// Fetch user's created tokens directly from API
	const { data: createdTokens = [], isLoading: tokensLoading } =
		useMyTokens();

	// Calculate aggregate stats
	const stats = useMemo((): TokenStats => {
		if (!createdTokens.length) {
			return {
				totalVolume: 0,
				totalTrades: 0,
				totalHolders: 0,
				estimatedEarnings: 0,
			};
		}

		const totalVolume = createdTokens.reduce(
			(sum, token) => sum + parseFloat(token.volume24h || "0"),
			0,
		);
		const totalTrades = createdTokens.reduce(
			(sum, token) => sum + (token.tradesCount || 0),
			0,
		);
		const totalHolders = createdTokens.reduce(
			(sum, token) => sum + (token.holdersCount || 0),
			0,
		);
		// Creator fee is 1% of volume
		const estimatedEarnings = totalVolume * 0.01;

		return {
			totalVolume,
			totalTrades,
			totalHolders,
			estimatedEarnings,
		};
	}, [createdTokens]);

	// Not connected state
	if (!isAuthenticated ) {
		return (
			<div
				className={cn(
					"bg-card border border-border rounded-xl p-8 text-center",
					className,
				)}
			>
				<Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 className="text-lg font-semibold mb-2">
					Creator Dashboard
				</h3>
				<p className="text-muted-foreground mb-4">
					Connect your wallet to view your created tokens and earnings
				</p>
			</div>
		);
	}

	// Loading state
	if (tokensLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}
				</div>
				<Skeleton className="h-[300px] rounded-xl" />
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Stats Overview */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="bg-card border border-border rounded-xl p-4"
				>
					<div className="flex items-center gap-2 mb-2">
						<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
							<Coins className="h-4 w-4 text-primary" />
						</div>
						<span className="text-sm text-muted-foreground">
							Tokens Created
						</span>
					</div>
					<p className="text-2xl font-bold">{createdTokens.length}</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					className="bg-card border border-border rounded-xl p-4"
				>
					<div className="flex items-center gap-2 mb-2">
						<div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
							<DollarSign className="h-4 w-4 text-green-500" />
						</div>
						<span className="text-sm text-muted-foreground">
							Est. Earnings
						</span>
					</div>
					<p className="text-2xl font-bold text-green-500">
						{formatCurrency(stats.estimatedEarnings)}
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="bg-card border border-border rounded-xl p-4"
				>
					<div className="flex items-center gap-2 mb-2">
						<div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
							<BarChart3 className="h-4 w-4 text-blue-500" />
						</div>
						<span className="text-sm text-muted-foreground">
							Total Volume
						</span>
					</div>
					<p className="text-2xl font-bold">
						{formatCurrency(stats.totalVolume)}
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
					className="bg-card border border-border rounded-xl p-4"
				>
					<div className="flex items-center gap-2 mb-2">
						<div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
							<Users className="h-4 w-4 text-purple-500" />
						</div>
						<span className="text-sm text-muted-foreground">
							Total Holders
						</span>
					</div>
					<p className="text-2xl font-bold">{stats.totalHolders}</p>
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
							<TabsTrigger value="overview" className="gap-2">
								<BarChart3 className="h-4 w-4" />
								Overview
							</TabsTrigger>
							<TabsTrigger value="tokens" className="gap-2">
								<Coins className="h-4 w-4" />
								My Tokens
							</TabsTrigger>
							<TabsTrigger value="earnings" className="gap-2">
								<DollarSign className="h-4 w-4" />
								Earnings
							</TabsTrigger>
						</TabsList>

						<Link href="/create">
							<Button className="gap-2 bg-gradient-to-r from-primary to-purple-600">
								<Plus className="h-4 w-4" />
								Create Token
							</Button>
						</Link>
					</div>

					{/* Overview Tab */}
					<TabsContent value="overview" className="space-y-4">
						{createdTokens.length === 0 ? (
							<div className="bg-card border border-border rounded-xl p-12 text-center">
								<Rocket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
								<h3 className="text-xl font-semibold mb-2">
									No Tokens Yet
								</h3>
								<p className="text-muted-foreground mb-6 max-w-md mx-auto">
									Create your first memecoin and start earning
									creator fees from every trade!
								</p>
								<Link href="/create">
									<Button className="gap-2 bg-gradient-to-r from-primary to-purple-600">
										<Plus className="h-4 w-4" />
										Create Your First Token
									</Button>
								</Link>
							</div>
						) : (
							<>
								{/* Top Performing Tokens */}
								<div className="bg-card border border-border rounded-xl p-4">
									<h3 className="font-semibold mb-4 flex items-center gap-2">
										<TrendingUp className="h-4 w-4 text-primary" />
										Top Performing Tokens
									</h3>
									<div className="space-y-3">
										{createdTokens
											.sort(
												(a, b) =>
													parseFloat(
														b.volume24h || "0",
													) -
													parseFloat(
														a.volume24h || "0",
													),
											)
											.slice(0, 5)
											.map((token, index) => (
												<Link
													key={token.id}
													href={`/token/${token.id}`}
													className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors"
												>
													<div className="flex items-center gap-3">
														<span className="text-sm text-muted-foreground w-5">
															#{index + 1}
														</span>
														<TokenImage
															src={token.imageUrl}
															alt={token.name}
															symbol={
																token.symbol
															}
															size={40}
														/>
														<div>
															<p className="font-medium">
																{token.name}
															</p>
															<p className="text-xs text-muted-foreground">
																${token.symbol}
															</p>
														</div>
													</div>
													<div className="text-right">
														<p className="font-medium">
															{formatCurrency(
																parseFloat(
																	token.marketCap ||
																		"0",
																),
															)}
														</p>
														<p
															className={cn(
																"text-xs",
																(token.priceChange24h ||
																	0) >= 0
																	? "text-green-500"
																	: "text-destructive",
															)}
														>
															{(token.priceChange24h ||
																0) >= 0
																? "+"
																: ""}
															{(
																token.priceChange24h ||
																0
															).toFixed(2)}
															%
														</p>
													</div>
												</Link>
											))}
									</div>
								</div>

								{/* Recent Activity */}
								<div className="bg-card border border-border rounded-xl p-4">
									<h3 className="font-semibold mb-4 flex items-center gap-2">
										<Clock className="h-4 w-4 text-primary" />
										Recent Activity
									</h3>
									<div className="text-center py-8 text-muted-foreground">
										<BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
										<p>Activity tracking coming soon</p>
									</div>
								</div>
							</>
						)}
					</TabsContent>

					{/* Tokens Tab */}
					<TabsContent value="tokens" className="space-y-4">
						{createdTokens.length === 0 ? (
							<div className="bg-card border border-border rounded-xl p-12 text-center">
								<Coins className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
								<h3 className="text-xl font-semibold mb-2">
									No Tokens Created
								</h3>
								<p className="text-muted-foreground mb-6">
									Launch your first token and start building
									your community!
								</p>
								<Link href="/create">
									<Button className="gap-2">
										<Plus className="h-4 w-4" />
										Create Token
									</Button>
								</Link>
							</div>
						) : (
							<div className="grid md:grid-cols-2 gap-4">
								{createdTokens.map((token) => (
									<TokenCreatorCard
										key={token.id}
										token={token}
									/>
								))}
							</div>
						)}
					</TabsContent>

					{/* Earnings Tab */}
					<TabsContent value="earnings" className="space-y-4">
						<div className="bg-card border border-border rounded-xl p-6">
							<div className="flex items-center justify-between mb-6">
								<h3 className="font-semibold flex items-center gap-2">
									<DollarSign className="h-5 w-5 text-green-500" />
									Creator Earnings
								</h3>
								<Badge
									variant="outline"
									className="text-green-500 border-green-500/30"
								>
									1% Creator Fee
								</Badge>
							</div>

							<div className="grid md:grid-cols-3 gap-4 mb-6">
								<div className="p-4 bg-background/50 rounded-lg">
									<p className="text-sm text-muted-foreground mb-1">
										Total Earned
									</p>
									<p className="text-2xl font-bold text-green-500">
										{formatCurrency(
											stats.estimatedEarnings,
										)}
									</p>
								</div>
								<div className="p-4 bg-background/50 rounded-lg">
									<p className="text-sm text-muted-foreground mb-1">
										Pending
									</p>
									<p className="text-2xl font-bold">$0.00</p>
								</div>
								<div className="p-4 bg-background/50 rounded-lg">
									<p className="text-sm text-muted-foreground mb-1">
										Claimed
									</p>
									<p className="text-2xl font-bold">$0.00</p>
								</div>
							</div>

							<div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
								<div className="flex items-center gap-2 mb-2">
									<Sparkles className="h-4 w-4 text-primary" />
									<span className="font-medium">
										How Creator Fees Work
									</span>
								</div>
								<ul className="text-sm text-muted-foreground space-y-1">
									<li>
										• You earn 1% of every trade on your
										tokens
									</li>
									<li>
										• Fees accumulate in the bonding curve
										contract
									</li>
									<li>
										• Claim your earnings anytime (gas fees
										apply)
									</li>
									<li>• Earnings are paid in MATIC</li>
								</ul>
							</div>
						</div>

						{/* Earnings by Token */}
						<div className="bg-card border border-border rounded-xl p-4">
							<h3 className="font-semibold mb-4">
								Earnings by Token
							</h3>
							{createdTokens.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<p>No tokens to show earnings for</p>
								</div>
							) : (
								<div className="space-y-3">
									{createdTokens.map((token) => {
										const earnings =
											parseFloat(token.volume24h || "0") *
											0.01;
										return (
											<div
												key={token.id}
												className="flex items-center justify-between p-3 rounded-lg bg-background/50"
											>
												<div className="flex items-center gap-3">
													<TokenImage
														src={token.imageUrl}
														alt={token.name}
														symbol={token.symbol}
														size={32}
													/>
													<div>
														<p className="font-medium text-sm">
															{token.name}
														</p>
														<p className="text-xs text-muted-foreground">
															Vol:{" "}
															{formatCurrency(
																parseFloat(
																	token.volume24h ||
																		"0",
																),
															)}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="font-medium text-green-500">
														+
														{formatCurrency(
															earnings,
														)}
													</p>
													<p className="text-xs text-muted-foreground">
														{token.tradesCount || 0}{" "}
														trades
													</p>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</motion.div>
		</div>
	);
}

// Token Card for Creator Dashboard
function TokenCreatorCard({ token }: { token: Token }) {
	const pricePositive = (token.priceChange24h || 0) >= 0;

	return (
		<Link href={`/token/${token.id}`}>
			<div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
				<div className="flex items-start gap-3 mb-4">
					<TokenImage
						src={token.imageUrl}
						alt={token.name}
						symbol={token.symbol}
						size={48}
					/>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<p className="font-semibold truncate">
								{token.name}
							</p>
							{token.status === "graduated" && (
								<Badge className="bg-green-500/20 text-green-500 text-xs">
									Graduated
								</Badge>
							)}
						</div>
						<p className="text-sm text-muted-foreground">
							${token.symbol}
						</p>
					</div>
					<div
						className={cn(
							"flex items-center gap-1 text-sm font-medium",
							pricePositive
								? "text-green-500"
								: "text-destructive",
						)}
					>
						{pricePositive ? (
							<TrendingUp className="h-4 w-4" />
						) : (
							<TrendingDown className="h-4 w-4" />
						)}
						{pricePositive ? "+" : ""}
						{(token.priceChange24h || 0).toFixed(2)}%
					</div>
				</div>

				<div className="grid grid-cols-3 gap-3 text-sm">
					<div>
						<p className="text-muted-foreground text-xs">
							Market Cap
						</p>
						<p className="font-medium">
							{formatCurrency(parseFloat(token.marketCap || "0"))}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">
							Volume 24h
						</p>
						<p className="font-medium">
							{formatCurrency(parseFloat(token.volume24h || "0"))}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Holders</p>
						<p className="font-medium">{token.holdersCount || 0}</p>
					</div>
				</div>

				{/* Bonding Curve Progress */}
				<div className="mt-4 pt-3 border-t border-border">
					<div className="flex items-center justify-between text-xs mb-1">
						<span className="text-muted-foreground">
							Bonding Curve
						</span>
						<span className="font-medium">
							{token.bondingCurveProgress || 0}%
						</span>
					</div>
					<Progress
						value={token.bondingCurveProgress || 0}
						className="h-1.5"
					/>
				</div>
			</div>
		</Link>
	);
}
