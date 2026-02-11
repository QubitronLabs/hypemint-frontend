/**
 * Token Layout — SEO handled centrally by app/layout.tsx
 * @see src/lib/seo/router.ts → handleTokenPage()
 */
export default function TokenLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
