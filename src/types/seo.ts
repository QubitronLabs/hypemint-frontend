import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────
// Backend API Response Shapes
// ─────────────────────────────────────────────────────────

/**
 * Raw SEO data returned from the backend API
 * Endpoint: GET /api/v1/pages/:slug/seo
 */
export interface SeoApiResponse {
	pageTitle?: string;
	metaDescription?: string;
	keywords?: string[];
	canonicalUrl?: string;
	robots?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogType?: string;
	ogUrl?: string;
	twitterCard?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
	schemaJson?: Record<string, unknown>;
}

/**
 * Page content data from the backend
 * Endpoint: GET /api/v1/pages/:slug
 */
export interface SeoPageData {
	title: string;
	slug: string;
	content: string;
	updatedAt?: string;
}

// ─────────────────────────────────────────────────────────
// Site-wide Configuration
// ─────────────────────────────────────────────────────────

/**
 * Site-wide SEO defaults used as fallback values
 */
export interface SeoDefaults {
	siteName: string;
	siteUrl: string;
	defaultTitle: string;
	defaultDescription: string;
	defaultKeywords: string[];
	defaultOgImage: string;
	twitterHandle?: string;
	icons: Metadata["icons"];
	manifest?: string;
}

// ─────────────────────────────────────────────────────────
// Lightweight Data Shapes for SEO (fetched without auth)
// ─────────────────────────────────────────────────────────

/**
 * Minimal token data needed to build SEO metadata
 * Fetched via plain fetch (no auth interceptor)
 */
export interface SeoTokenData {
	name: string;
	symbol: string;
	description?: string;
	imageUrl?: string;
	currentPrice?: string;
	marketCap?: string;
	status?: string;
}

/**
 * Minimal user data needed to build SEO metadata
 * Fetched via plain fetch (no auth interceptor)
 */
export interface SeoUserData {
	displayName?: string;
	username?: string;
	bio?: string;
	avatarUrl?: string;
	tokensCreated?: number;
	followersCount?: number;
}
