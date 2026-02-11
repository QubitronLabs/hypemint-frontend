/**
 * SEO Module — Barrel Export
 *
 * Usage in app/layout.tsx:
 *   import { resolveMetadata } from "@/lib/seo";
 *
 * Usage for direct access to defaults/config:
 *   import { seoDefaults, getDefaultMetadata } from "@/lib/seo";
 */

export { resolveMetadata } from "./router";
export {
	seoDefaults,
	getDefaultMetadata,
	getCreatePageMetadata,
	getProfilePageMetadata,
} from "./defaults";
