/**
 * User Layout — SEO handled centrally by app/layout.tsx
 * @see src/lib/seo/router.ts → handleUserPage()
 */
export default function UserLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
