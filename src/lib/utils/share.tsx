"use client";

import React from "react";
import {
	TwitterShareButton,
	TelegramShareButton,
	FacebookShareButton,
	WhatsappShareButton,
	RedditShareButton,
	LinkedinShareButton,
	TwitterIcon,
	TelegramIcon,
	FacebookIcon,
	WhatsappIcon,
	RedditIcon,
	LinkedinIcon,
} from "react-share";
import { Link2, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Supported share platforms
 */
export type SharePlatform =
	| "twitter"
	| "telegram"
	| "facebook"
	| "whatsapp"
	| "reddit"
	| "linkedin"
	| "copy";

/**
 * Share options configuration
 */
export interface ShareOptions {
	/** URL to share */
	url: string;
	/** Title/heading for the share */
	title: string;
	/** Description/message for the share */
	description?: string;
	/** Hashtags for Twitter (without #) */
	hashtags?: string[];
	/** Which platforms to show (defaults to all) */
	platforms?: SharePlatform[];
	/** Size of the share icons */
	iconSize?: number;
	/** Whether to show labels under icons */
	showLabels?: boolean;
}

/**
 * Default platforms to show
 */
const DEFAULT_PLATFORMS: SharePlatform[] = [
	"twitter",
	"telegram",
	"whatsapp",
	"facebook",
	"reddit",
	"copy",
];

/**
 * Platform configuration with icons and labels
 */
const platformConfig = {
	twitter: {
		label: "Twitter/X",
		icon: TwitterIcon,
		button: TwitterShareButton,
	},
	telegram: {
		label: "Telegram",
		icon: TelegramIcon,
		button: TelegramShareButton,
	},
	facebook: {
		label: "Facebook",
		icon: FacebookIcon,
		button: FacebookShareButton,
	},
	whatsapp: {
		label: "WhatsApp",
		icon: WhatsappIcon,
		button: WhatsappShareButton,
	},
	reddit: {
		label: "Reddit",
		icon: RedditIcon,
		button: RedditShareButton,
	},
	linkedin: {
		label: "LinkedIn",
		icon: LinkedinIcon,
		button: LinkedinShareButton,
	},
	copy: {
		label: "Copy Link",
		icon: null,
		button: null,
	},
};

/**
 * ShareMenu Component - A modal/popup with share options
 */
interface ShareMenuProps extends ShareOptions {
	isOpen: boolean;
	onClose: () => void;
}

export function ShareMenu({
	isOpen,
	onClose,
	url,
	title,
	description,
	hashtags = [],
	platforms = DEFAULT_PLATFORMS,
	iconSize = 40,
	showLabels = true,
}: ShareMenuProps) {
	const [copied, setCopied] = React.useState(false);

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			toast.success("Link copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy link");
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", duration: 0.3 }}
						className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl"
					>
						{/* Header */}
						<div className="flex items-center justify-between mb-6">
							<h3 className="text-lg font-semibold">Share</h3>
							<Button
								variant="ghost"
								size="icon"
								onClick={onClose}
								className="h-8 w-8 rounded-full"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						{/* Share Title Preview */}
						<div className="mb-6 p-3 bg-muted/50 rounded-lg">
							<p className="text-sm font-medium truncate">
								{title}
							</p>
							{description && (
								<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
									{description}
								</p>
							)}
						</div>

						{/* Share Buttons Grid */}
						<div className="grid grid-cols-4 gap-4">
							{platforms.map((platform) => {
								if (platform === "copy") {
									return (
										<motion.button
											key={platform}
											whileHover={{ scale: 1.05 }}
											whileTap={{ scale: 0.95 }}
											onClick={handleCopyLink}
											className="flex flex-col items-center gap-2"
										>
											<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
												{copied ? (
													<Check className="h-5 w-5 text-green-500" />
												) : (
													<Link2 className="h-5 w-5" />
												)}
											</div>
											{showLabels && (
												<span className="text-xs text-muted-foreground">
													{copied
														? "Copied!"
														: "Copy"}
												</span>
											)}
										</motion.button>
									);
								}

								const config = platformConfig[platform];
								if (!config.button || !config.icon) return null;

								const ShareButton = config.button;
								const ShareIcon = config.icon;

								return (
									<motion.div
										key={platform}
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										className="flex flex-col items-center gap-2"
									>
										<ShareButton
											url={url}
											title={
												platform === "twitter"
													? `${title} ${description || ""}`
													: title
											}
											hashtags={
												platform === "twitter"
													? hashtags
													: undefined
											}
											className="focus:outline-none"
										>
											<ShareIcon size={iconSize} round />
										</ShareButton>
										{showLabels && (
											<span className="text-xs text-muted-foreground">
												{config.label}
											</span>
										)}
									</motion.div>
								);
							})}
						</div>

						{/* Copy URL Input */}
						<div className="mt-6 flex items-center gap-2">
							<div className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground truncate">
								{url}
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopyLink}
								className="shrink-0 gap-2"
							>
								{copied ? (
									<Check className="h-4 w-4 text-green-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/**
 * useShare hook - provides share menu state and controls
 */
export function useShare(
	options: Omit<ShareOptions, "url"> & { url?: string },
) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [shareUrl, setShareUrl] = React.useState(options.url || "");

	const open = React.useCallback((url?: string) => {
		if (url) setShareUrl(url);
		else if (typeof window !== "undefined")
			setShareUrl(window.location.href);
		setIsOpen(true);
	}, []);

	const close = React.useCallback(() => {
		setIsOpen(false);
	}, []);

	const ShareMenuComponent = React.useCallback(
		() => (
			<ShareMenu
				{...options}
				url={
					shareUrl ||
					(typeof window !== "undefined" ? window.location.href : "")
				}
				isOpen={isOpen}
				onClose={close}
			/>
		),
		[isOpen, close, shareUrl, options],
	);

	return {
		isOpen,
		open,
		close,
		ShareMenu: ShareMenuComponent,
	};
}

/**
 * Quick share function - uses native share API if available, fallback to copy
 */
export async function quickShare(options: ShareOptions): Promise<boolean> {
	const { url, title, description } = options;

	// Try native share API first (mobile)
	if (typeof navigator !== "undefined" && navigator.share) {
		try {
			await navigator.share({
				title,
				text: description,
				url,
			});
			return true;
		} catch {
			// User cancelled or error, continue to fallback
		}
	}

	// Fallback to copy
	try {
		await navigator.clipboard.writeText(url);
		toast.success("Link copied to clipboard!");
		return true;
	} catch {
		toast.error("Failed to share");
		return false;
	}
}
