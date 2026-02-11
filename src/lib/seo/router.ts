/**
 * SEO Router — Central Metadata Resolution
 *
 * This is the ONLY place that decides which metadata to return for a given route.
 * It reads the current pathname from the `x-pathname` header (set by middleware)
 * and dispatches to the appropriate handler.
 *
 * Flow:  middleware → x-pathname header → resolveMetadata() → Metadata
 *
 * To add SEO for a new page:
 *   1. Add a matcher in matchRoute()
 *   2. Create a handler function
 *   3. If the page needs API data, add a fetch in lib/api/seo.ts
 *   4. If the page needs static metadata, add it in lib/seo/defaults.ts
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SeoApiResponse } from "@/types/seo";
import {
	seoDefaults,
	getDefaultMetadata,
	getCreatePageMetadata,
	getProfilePageMetadata,
} from "./defaults";
import {
	fetchSeoData,
	fetchTokenForSeo,
	fetchUserForSeo,
	fetchPageData,
} from "@/lib/api/seo";

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Resolve metadata for the current request.
 * Called from app/layout.tsx → generateMetadata().
 *
 * Always returns base metadata (icons, manifest) merged with
 * page-specific metadata from the matched route handler.
 */
export async function resolveMetadata(): Promise<Metadata> {
	const headersList = await headers();
	const pathname = headersList.get("x-pathname") || "/";

	// Base metadata applied to every page (icons, manifest)
	const baseMetadata: Metadata = {
		icons: seoDefaults.icons,
		manifest: seoDefaults.manifest,
	};

	try {
		const pageMetadata = await matchRoute(pathname);
		return { ...baseMetadata, ...pageMetadata };
	} catch (error) {
		console.error("[SEO] Error resolving metadata for:", pathname, error);
		return { ...baseMetadata, ...getDefaultMetadata() };
	}
}

// ─────────────────────────────────────────────────────────
// Route Matcher
// ─────────────────────────────────────────────────────────

/**
 * Maps a pathname to its metadata handler.
 * Add new routes here as the app grows.
 */
async function matchRoute(pathname: string): Promise<Metadata> {
	// ── Home ──────────────────────────────────────────────
	if (pathname === "/") {
		return handleHomePage();
	}

	// ── Token detail: /token/{id} ────────────────────────
	const tokenMatch = pathname.match(/^\/token\/([^/]+)$/);
	if (tokenMatch) {
		return handleTokenPage(tokenMatch[1]);
	}

	// ── User profile: /user/{address} ────────────────────
	const userMatch = pathname.match(/^\/user\/([^/]+)$/);
	if (userMatch) {
		return handleUserPage(userMatch[1]);
	}

	// ── Docs: /docs/{slug} ───────────────────────────────
	const docsMatch = pathname.match(/^\/docs\/([^/]+)$/);
	if (docsMatch) {
		return handleDocsPage(docsMatch[1]);
	}

	// ── Create (static) ──────────────────────────────────
	if (pathname === "/create") {
		return getCreatePageMetadata();
	}

	// ── Profile (static) ─────────────────────────────────
	if (pathname === "/profile") {
		return getProfilePageMetadata();
	}

	// ── Fallback ─────────────────────────────────────────
	return getDefaultMetadata();
}

// ─────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────

/**
 * Home page → fetch SEO from CMS with "home" slug
 */
async function handleHomePage(): Promise<Metadata> {
	const seoData = await fetchSeoData("home");
	if (seoData) {
		return buildMetadataFromSeoApi(seoData);
	}
	return getDefaultMetadata();
}

/**
 * Token detail → build SEO from token data
 */
async function handleTokenPage(tokenId: string): Promise<Metadata> {
	const token = await fetchTokenForSeo(tokenId);

	if (!token) {
		return { title: `Token Not Found | ${seoDefaults.siteName}` };
	}

	const title = `${token.name} (${token.symbol}) | ${seoDefaults.siteName}`;
	const description =
		token.description ||
		`Trade ${token.name} ($${token.symbol}) on HypeMint — the memecoin launchpad with instant bonding curves.`;

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			images: token.imageUrl ? [token.imageUrl] : undefined,
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: token.imageUrl ? [token.imageUrl] : undefined,
		},
	};
}

/**
 * User profile → build SEO from user data
 */
async function handleUserPage(address: string): Promise<Metadata> {
	const user = await fetchUserForSeo(address);

	if (!user) {
		return { title: `User Not Found | ${seoDefaults.siteName}` };
	}

	const displayName = user.displayName || user.username || address;
	const title = `${displayName} | ${seoDefaults.siteName}`;
	const description =
		user.bio ||
		`View ${displayName}'s profile on HypeMint — ${user.tokensCreated || 0} tokens created, ${user.followersCount || 0} followers.`;

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			images: user.avatarUrl ? [user.avatarUrl] : undefined,
			type: "profile",
		},
		twitter: {
			card: "summary",
			title,
			description,
			images: user.avatarUrl ? [user.avatarUrl] : undefined,
		},
	};
}

/**
 * Docs page → fetch SEO + page data in parallel, merge
 */
async function handleDocsPage(slug: string): Promise<Metadata> {
	const [pageResult, seoResult] = await Promise.allSettled([
		fetchPageData(slug),
		fetchSeoData(slug),
	]);

	const page = pageResult.status === "fulfilled" ? pageResult.value : null;
	const seo = seoResult.status === "fulfilled" ? seoResult.value : null;

	if (!page && !seo) {
		return { title: `Page Not Found | ${seoDefaults.siteName}` };
	}

	const title = seo?.pageTitle || page?.title || seoDefaults.siteName;
	const description =
		seo?.metaDescription ||
		`${page?.title || slug} — ${seoDefaults.siteName}`;

	return {
		title: `${title} | ${seoDefaults.siteName}`,
		description,
		keywords: seo?.keywords,
		robots: seo?.robots,
		alternates: seo?.canonicalUrl
			? { canonical: seo.canonicalUrl }
			: undefined,
		openGraph: {
			title: seo?.ogTitle || title,
			description: seo?.ogDescription || description,
			images: seo?.ogImage ? [seo.ogImage] : undefined,
			type: (seo?.ogType as "website" | "article") || "website",
			url: seo?.ogUrl || undefined,
		},
		twitter: {
			card:
				(seo?.twitterCard as "summary" | "summary_large_image") ||
				"summary_large_image",
			title: seo?.twitterTitle || title,
			description: seo?.twitterDescription || description,
			images: seo?.twitterImage ? [seo.twitterImage] : undefined,
		},
	};
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Convert raw SeoApiResponse into a Next.js Metadata object.
 * Used for CMS-driven pages (home, about, etc.).
 */
function buildMetadataFromSeoApi(seo: SeoApiResponse): Metadata {
	const title = seo.pageTitle || seoDefaults.defaultTitle;
	const description = seo.metaDescription || seoDefaults.defaultDescription;

	return {
		title: title.includes(seoDefaults.siteName)
			? title
			: `${title} | ${seoDefaults.siteName}`,
		description,
		keywords: seo.keywords || seoDefaults.defaultKeywords,
		robots: seo.robots,
		alternates: seo.canonicalUrl
			? { canonical: seo.canonicalUrl }
			: undefined,
		openGraph: {
			title: seo.ogTitle || title,
			description: seo.ogDescription || description,
			images: seo.ogImage ? [seo.ogImage] : [seoDefaults.defaultOgImage],
			type: (seo.ogType as "website" | "article") || "website",
			url: seo.ogUrl || undefined,
			siteName: seoDefaults.siteName,
		},
		twitter: {
			card:
				(seo.twitterCard as "summary" | "summary_large_image") ||
				"summary_large_image",
			title: seo.twitterTitle || title,
			description: seo.twitterDescription || description,
			images: seo.twitterImage
				? [seo.twitterImage]
				: [seoDefaults.defaultOgImage],
		},
	};
}
