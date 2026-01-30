"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import {
	Home,
	Video,
	Terminal,
	User,
	HelpCircle,
	Plus,
	TrendingUp,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/lib/sidebar";

const navItems = [
	{ icon: Home, label: "Home", href: "/" },
	{ icon: TrendingUp, label: "Trending", href: "/trending", disabled: true },
	{ icon: Video, label: "Live", href: "/livestreams", disabled: true },
	{ icon: Terminal, label: "Terminal", href: "/terminal", disabled: true },
	{ icon: User, label: "Profile", href: "/profile" },
	{ icon: HelpCircle, label: "Help", href: "/support", disabled: true },
];

export function Sidebar() {
	const pathname = usePathname();
	const { isOpen, close } = useSidebarStore();

	// Prevent body scroll on mobile when sidebar is open
	useEffect(() => {
		const isMobile = window.innerWidth < 768;

		if (isMobile && isOpen) {
			// Disable scrolling
			document.body.style.overflow = "clip";
		} else {
			// Re-enable scrolling
			document.body.style.overflow = "unset";
		}

		// Cleanup function to restore scrolling when component unmounts
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	// Close sidebar on navigation (mobile)
	const handleNavClick = () => {
		if (window.innerWidth < 768) {
			close();
		}
	};

	return (
		<>
			{/* Mobile Overlay */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={close}
						className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
					/>
				)}
			</AnimatePresence>

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed left-0 top-0 z-50 h-full w-[70px] bg-card/95 backdrop-blur-xl border-r border-border/50 flex flex-col transition-transform duration-300 ease-in-out",
					// Mobile: hidden by default, shown when isOpen
					"max-md:-translate-x-full",
					isOpen && "max-md:translate-x-0",
					// Desktop: always visible
					"md:translate-x-0",
				)}
			>
				{/* Logo with close button on mobile */}
				<div className="flex items-center justify-between h-16 border-b border-border/50 px-3">
					<Link
						href="/"
						className="flex items-center justify-center flex-1"
						onClick={handleNavClick}
					>
						<motion.div
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className="w-10 h-10 rounded-xl flex items-center justify-center"
						>
							<img src="/logo2.png" alt="HypeMint" />
						</motion.div>
					</Link>
					{/* Close button - mobile only when sidebar is open */}
					{isOpen && (
						<Button
							onClick={close}
							className="md:hidden h-auto p-2! bg-card/95 text-muted-foreground hover:text-foreground transition-colors rounded-full border-r border-"
						>
							<X className="h-5 w-5" />
						</Button>
					)}
				</div>

				{/* Navigation */}
				<nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
					{navItems.map((item) => {
						const isActive = pathname === item.href;
						const Icon = item.icon;

						return (
							<Link
								key={item.href}
								href={item.disabled ? "#" : item.href}
								onClick={handleNavClick}
								className={cn(
									"relative flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200",
									isActive
										? "text-primary bg-primary/10"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
									item.disabled &&
										"opacity-40 cursor-not-allowed",
								)}
							>
								{isActive && (
									<motion.div
										layoutId="active-indicator"
										className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
										initial={false}
										transition={{
											type: "spring",
											stiffness: 400,
											damping: 25,
										}}
									/>
								)}
								<motion.div
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									transition={{
										type: "spring",
										stiffness: 400,
										damping: 17,
									}}
								>
									<Icon className="h-5 w-5" />
								</motion.div>
								<span className="text-[10px] mt-1.5 font-medium">
									{item.label}
								</span>
							</Link>
						);
					})}
				</nav>

				{/* Create Button */}
				<div className="p-3 border-t border-border/50">
					<Link href="/create" onClick={handleNavClick}>
						<motion.div
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							className="w-full h-11 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors cursor-pointer"
						>
							<Plus className="h-4 w-4 text-primary-foreground" />
							<span className="text-[9px] font-semibold text-primary-foreground">
								Create
							</span>
						</motion.div>
					</Link>
				</div>
			</aside>
		</>
	);
}
