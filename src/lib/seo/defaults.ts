import type { Metadata } from "next";
import type { SeoDefaults } from "@/types/seo";

// ─────────────────────────────────────────────────────────
// Site-wide SEO Defaults
// ─────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hypemint.com";

/**
 * Global SEO defaults — single source of truth for all fallback values.
 * To change defaults globally, modify this object.
 */
export const seoDefaults: SeoDefaults = {
	siteName: "HypeMint",
	siteUrl: SITE_URL,
	defaultTitle: "HypeMint - Memecoin Launchpad",
	defaultDescription:
		"Launch and trade memecoins with instant bonding curves. The fastest way to create and discover new tokens.",
	defaultKeywords: [
		"memecoin",
		"crypto",
		"launchpad",
		"trading",
		"bonding curve",
		"defi",
	],
	defaultOgImage: `${SITE_URL}/og-image.png`,
	twitterHandle: "@hypemint",
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{
				url: "/favicon-16x16.png",
				sizes: "16x16",
				type: "image/png",
			},
			{
				url: "/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
			},
			{
				url: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				url: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
		apple: [{ url: "/apple-touch-icon.png" }],
	},
	manifest: "/site.webmanifest",
};

// ─────────────────────────────────────────────────────────
// Metadata Builders
// ─────────────────────────────────────────────────────────

/**
 * Build the full default Metadata object (used for home page fallback & unknown routes)
 */
export function getDefaultMetadata(): Metadata {
	return {
		title: seoDefaults.defaultTitle,
		description: seoDefaults.defaultDescription,
		keywords: seoDefaults.defaultKeywords,
		openGraph: {
			title: seoDefaults.defaultTitle,
			description: seoDefaults.defaultDescription,
			siteName: seoDefaults.siteName,
			type: "website",
			images: [seoDefaults.defaultOgImage],
		},
		twitter: {
			card: "summary_large_image",
			title: seoDefaults.defaultTitle,
			description: seoDefaults.defaultDescription,
			images: [seoDefaults.defaultOgImage],
		},
	};
}

// ─────────────────────────────────────────────────────────
// Static Page Metadata (no API calls)
// ─────────────────────────────────────────────────────────

/**
 * Static metadata for /create page
 */
export function getCreatePageMetadata(): Metadata {
	const title = `Create Token | ${seoDefaults.siteName}`;
	const description =
		"Launch your own memecoin on HypeMint with instant bonding curves. Set up your token name, symbol, and start trading in seconds.";

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

/**
 * Static metadata for /profile page
 */
export function getProfilePageMetadata(): Metadata {
	const title = `My Profile | ${seoDefaults.siteName}`;
	const description =
		"View your HypeMint profile, portfolio, and creator dashboard. Track your created tokens and trading activity.";

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "profile",
		},
		twitter: {
			card: "summary",
			title,
			description,
		},
	};
}
