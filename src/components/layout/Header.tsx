"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Command, Menu } from "lucide-react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar";

export function Header() {
	const [searchFocused, setSearchFocused] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const { toggle } = useSidebarStore();

	// Keyboard shortcut for search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				searchRef.current?.focus();
			}
			if (e.key === "Escape") {
				searchRef.current?.blur();
				setSearchQuery("");
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<header className="fixed top-0 left-0 md:left-[70px] right-0 z-30 h-14 md:h-16 bg-card/80 backdrop-blur-xl border-b border-border/50">
			<div className="flex items-center justify-between h-full px-3 md:px-6 gap-2 md:gap-4">
				{/* Hamburger Menu - Mobile Only */}
				<button
					onClick={toggle}
					className="md:hidden p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
				>
					<Menu className="h-5 w-5" />
				</button>

				{/* Logo - Mobile Only */}
				<Link href="/" className="md:hidden shrink-0">
					<img src="/logo2.png" alt="HypeMint" className="w-8 h-8" />
				</Link>

				{/* Search */}
				<div className="flex-1 max-w-lg">
					<div className="relative">
						<Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							ref={searchRef}
							type="search"
							placeholder="Search tokens..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onFocus={() => setSearchFocused(true)}
							onBlur={() =>
								setTimeout(() => setSearchFocused(false), 200)
							}
							className={cn(
								"pl-9 md:pl-11 pr-4 md:pr-16 h-9 md:h-11 bg-muted/50 border-border/50 rounded-xl text-sm",
								"focus:border-primary/50 focus:bg-muted/80 transition-all duration-200",
							)}
						/>

						{searchQuery ? (
							<motion.button
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								onClick={() => setSearchQuery("")}
								className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent"
							>
								<X className="h-4 w-4" />
							</motion.button>
						) : (
							<div className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-0.5 text-muted-foreground/50">
								<kbd className="flex items-center text-[10px] bg-background/80 px-1.5 py-0.5 rounded-md border border-border/50">
									<Command className="h-2.5 w-2.5" />K
								</kbd>
							</div>
						)}

						{/* Search Dropdown */}
						<AnimatePresence>
							{searchFocused && searchQuery && (
								<motion.div
									initial={{ opacity: 0, y: 8, scale: 0.95 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: 8, scale: 0.95 }}
									transition={{
										type: "spring",
										stiffness: 400,
										damping: 25,
									}}
									className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-4"
								>
									<div className="flex items-center justify-center py-6">
										<p className="text-sm text-muted-foreground">
											Searching for "{searchQuery}"...
										</p>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2 md:gap-4 shrink-0">
					{/* Network - Hidden on mobile */}
					<motion.div
						whileHover={{ scale: 1.05 }}
						className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl border border-border/50"
					>
						<span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
						<span className="font-medium">Polygon</span>
					</motion.div>

					{/* Create Button */}
					<Link href="/create" className="hidden sm:block">
						<motion.div
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							className="h-9 md:h-10 px-3 md:px-4 rounded-lg bg-primary hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer"
						>
							<Plus className="h-4 w-4 text-primary-foreground" />
							<span className="hidden md:inline font-semibold text-sm text-primary-foreground">
								Create
							</span>
						</motion.div>
					</Link>

					{/* Wallet - Compact on mobile */}
					<div className="[&_button]:!h-9 md:[&_button]:!h-10 [&_button]:!rounded-xl [&_button]:!border-border/50 [&_button]:!bg-muted/50 [&_button]:!px-2 md:[&_button]:!px-3">
						<DynamicWidget />
					</div>
				</div>
			</div>
		</header>
	);
}
