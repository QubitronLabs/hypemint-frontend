"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebarStore } from "@/lib/sidebar";
import { SearchBox } from "@/components/search";
import { useAuth } from "@/hooks";

// Dynamic import DynamicWidget to prevent SSR issues
const DynamicWidget = dynamic(
	() =>
		import("@dynamic-labs/sdk-react-core").then((mod) => mod.DynamicWidget),
	{
		ssr: false,
		loading: () => <Skeleton className="h-9 md:h-10 w-24 rounded-xl" />,
	},
);

export function Header() {
	const { toggle } = useSidebarStore();
	const { isAuthenticated } = useAuth();

	return (
		<header className="fixed top-0 left-0 md:left-[70px] right-0 z-30 h-14 md:h-16 bg-card backdrop-blur-xl border-b border-border/50">
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
					<img
						src="/hypemint-logo.webp"
						alt="HypeMint"
						className="w-8 h-8"
					/>
				</Link>

				{/* Search Box */}
				<div className="flex-1 max-w-lg">
					<SearchBox className="shadow-lg shadow-amber-" />
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2 md:gap-4 shrink-0">
					{/* Create Button */}
					{isAuthenticated && (
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
					)}

					{/* Wallet - Compact on mobile */}
					<div className="[&_button]:!h-9 md:[&_button]:!h-10 [&_button]:!rounded-xl [&_button]:!border-border/50 [&_button]:!bg-muted/50 [&_button]:!px-2 md:[&_button]:!px-3">
						<DynamicWidget />
					</div>
				</div>
			</div>
		</header>
	);
}
