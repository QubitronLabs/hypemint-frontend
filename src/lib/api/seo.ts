/**
 * SEO API Service
 *
 * Uses plain `fetch` instead of `apiClient` to avoid Zustand auth store
 * issues in React Server Components. All functions are safe for use in
 * generateMetadata and other server-side contexts.
 */

import type {
	SeoApiResponse,
	SeoPageData,
	SeoTokenData,
	SeoUserData,
} from "@/types/seo";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─────────────────────────────────────────────────────────
// Page SEO (docs, home, misc CMS pages)
// ─────────────────────────────────────────────────────────

/**
 * Fetch SEO metadata for a CMS-managed page.
 * Used for: home ("/home"), docs pages, any future CMS pages.
 *
 * @param slug - Page slug (e.g. "home", "about", "privacy-policy")
 */
export async function fetchSeoData(
	slug: string,
): Promise<SeoApiResponse | null> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/pages/${slug}/seo`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json?.data ?? null;
	} catch {
		return null;
	}
}

/**
 * Fetch page content data (used for docs pages to build title fallbacks).
 *
 * @param slug - Page slug
 */
export async function fetchPageData(slug: string): Promise<SeoPageData | null> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/pages/${slug}`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json?.data ?? null;
	} catch {
		return null;
	}
}

// ─────────────────────────────────────────────────────────
// Token SEO
// ─────────────────────────────────────────────────────────

/**
 * Fetch lightweight token data for building SEO metadata.
 * Does NOT go through the authenticated apiClient.
 *
 * @param tokenId - Token ID
 */
export async function fetchTokenForSeo(
	tokenId: string,
): Promise<SeoTokenData | null> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/tokens/${tokenId}`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json?.data?.token ?? null;
	} catch {
		return null;
	}
}

// ─────────────────────────────────────────────────────────
// User SEO
// ─────────────────────────────────────────────────────────

/**
 * Fetch lightweight user data for building SEO metadata.
 * Does NOT go through the authenticated apiClient.
 *
 * @param address - Wallet address
 */
export async function fetchUserForSeo(
	address: string,
): Promise<SeoUserData | null> {
	try {
		const res = await fetch(`${API_BASE}/api/v1/users/${address}`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		const json = await res.json();
		return json?.data?.user ?? null;
	} catch {
		return null;
	}
}
