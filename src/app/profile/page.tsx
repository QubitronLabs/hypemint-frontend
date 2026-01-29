"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
	ExternalLink,
	Copy,
	Check,
	Wallet,
	Bell,
	Rocket,
	PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorDashboard } from "@/components/dashboard";
import { Portfolio } from "@/components/portfolio";
import { useAuth, useCurrentUser } from "@/hooks";
import { getAddressUrl } from "@/lib/wagmi";

export default function ProfilePage() {
	const { isAuthenticated, isLoading, walletAddress, dynamicUser, logout } =
		useAuth();
	const { data: user } = useCurrentUser();

	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState("portfolio");

	const displayName =
		user?.displayName ||
		user?.username ||
		dynamicUser?.firstName ||
		dynamicUser?.email?.split("@")[0] ||
		null;

	const shortAddress = walletAddress
		? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
		: "Not connected";

	const handleCopy = () => {
		if (walletAddress) {
			navigator.clipboard.writeText(walletAddress);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="w-full mx-auto p-4 md:p-6">
				<div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-8">
					<Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
					<div className="flex-1 text-center sm:text-left">
						<Skeleton className="h-6 sm:h-8 w-32 sm:w-48 mb-2 mx-auto sm:mx-0" />
						<Skeleton className="h-4 w-24 sm:w-32 mx-auto sm:mx-0" />
					</div>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-16 md:h-20" />
					))}
				</div>
				<Skeleton className="h-[300px] md:h-[400px] rounded-xl" />
			</div>
		);
	}

	// Not connected
	if (!isAuthenticated) {
		return (
			<div className="min-h-[60vh] md:min-h-[80vh] flex items-center justify-center p-4 md:p-6">
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="text-center max-w-md px-4"
				>
					<div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
						<Wallet className="h-7 w-7 md:h-8 md:w-8 text-primary" />
					</div>
					<h1 className="text-lg md:text-xl font-bold mb-2">
						Connect Your Wallet
					</h1>
					<p className="text-sm md:text-base text-muted-foreground mb-6">
						Connect your wallet to view your profile, portfolio, and
						creator dashboard.
					</p>
				</motion.div>
			</div>
		);
	}

	return (
		<div className="w-full mx-auto p-4 md:p-6">
			{/* Profile Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 25 }}
				className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 mb-6 md:mb-8"
			>
				<div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left">
					<motion.div
						whileHover={{ scale: 1.05 }}
						transition={{ type: "spring", stiffness: 400 }}
					>
						<Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-border/50 shadow-xl ring-4 ring-primary/10">
							<AvatarImage
								src={user?.avatarUrl}
								alt={displayName || shortAddress}
							/>
							<AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-2xl md:text-3xl">
								{displayName?.slice(0, 2) || "🐸"}
							</AvatarFallback>
						</Avatar>
					</motion.div>

					<div>
						<h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
							{displayName || shortAddress}
						</h1>
						<div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 md:gap-3 mt-2">
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={handleCopy}
								className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground bg-muted/50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
							>
								{copied ? (
									<Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
								) : (
									<Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
								)}
								{shortAddress}
							</motion.button>
							{walletAddress && (
								<a
									href={getAddressUrl(walletAddress)}
									target="_blank"
									rel="noopener noreferrer"
									className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
								>
									View on Explorer
									<ExternalLink className="h-3.5 w-3.5" />
								</a>
							)}
						</div>

						{dynamicUser?.email && (
							<p className="text-xs sm:text-sm text-muted-foreground mt-2 flex items-center justify-center sm:justify-start gap-1.5">
								<span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
								{dynamicUser.email}
							</p>
						)}
					</div>
				</div>

				<div className="flex gap-2 sm:gap-3">
					<motion.div
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
					>
						<Button
							variant="ghost"
							size="sm"
							onClick={logout}
							className="text-destructive hover:text-destructive cursor-pointer bg-destructive/10 rounded-xl text-xs sm:text-sm"
						>
							Logout
						</Button>
					</motion.div>
				</div>
			</motion.div>

			{/* Stats */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{
					delay: 0.1,
					type: "spring",
					stiffness: 300,
					damping: 25,
				}}
				className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
			>
				{[
					{ label: "Followers", value: user?.followersCount ?? 0 },
					{ label: "Following", value: user?.followingCount ?? 0 },
					{ label: "Coins Created", value: user?.tokensCreated ?? 0 },
					{ label: "Total Trades", value: user?.tradesCount ?? 0 },
				].map((stat, i) => (
					<motion.div
						key={stat.label}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 + i * 0.05 }}
						className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-5 text-center hover:border-primary/20 transition-colors"
					>
						<p className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums">
							{stat.value}
						</p>
						<p className="text-xs sm:text-sm text-muted-foreground mt-1">
							{stat.label}
						</p>
					</motion.div>
				))}
			</motion.div>

			{/* Main Tabs */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{
					delay: 0.2,
					type: "spring",
					stiffness: 300,
					damping: 25,
				}}
			>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl mb-4 md:mb-6 p-1 w-full flex overflow-x-auto">
						<TabsTrigger
							value="portfolio"
							className="gap-1.5 sm:gap-2 rounded-lg data-[state=active]:shadow-sm flex-1 text-xs sm:text-sm"
						>
							<PieChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
							<span className="hidden xs:inline">Portfolio</span>
							<span className="xs:hidden">Port</span>
						</TabsTrigger>
						<TabsTrigger
							value="creator"
							className="gap-1.5 sm:gap-2 rounded-lg data-[state=active]:shadow-sm flex-1 text-xs sm:text-sm"
						>
							<Rocket className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
							<span className="hidden sm:inline">
								Creator Dashboard
							</span>
							<span className="sm:hidden">Creator</span>
						</TabsTrigger>
						<TabsTrigger
							value="notifications"
							className="gap-1.5 sm:gap-2 rounded-lg data-[state=active]:shadow-sm flex-1 text-xs sm:text-sm"
						>
							<Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
							<span className="hidden xs:inline">
								Notifications
							</span>
							<span className="xs:hidden">Notif</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="portfolio">
						<Portfolio />
					</TabsContent>

					<TabsContent value="creator">
						<CreatorDashboard />
					</TabsContent>

					<TabsContent value="notifications">
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-16 text-center"
						>
							<motion.div
								animate={{ y: [0, -5, 0] }}
								transition={{ repeat: Infinity, duration: 3 }}
							>
								<Bell className="h-14 w-14 md:h-20 md:w-20 mx-auto mb-4 md:mb-6 text-muted-foreground/30" />
							</motion.div>
							<h3 className="text-lg md:text-2xl font-bold mb-2 md:mb-3">
								No Notifications
							</h3>
							<p className="text-sm md:text-base text-muted-foreground max-w-sm mx-auto">
								You&apos;ll receive notifications for trades,
								token graduations, and more.
							</p>
						</motion.div>
					</TabsContent>
				</Tabs>
			</motion.div>
		</div>
	);
}
