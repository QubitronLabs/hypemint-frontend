/**
 * Create Layout — SEO handled centrally by app/layout.tsx
 * @see src/lib/seo/defaults.ts → getCreatePageMetadata()
 */
export default function CreateLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
