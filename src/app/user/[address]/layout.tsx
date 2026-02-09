import type { Metadata } from "next";

interface UserLayoutProps {
	children: React.ReactNode;
	params: Promise<{ address: string }>;
}

const API_BASE =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function generateMetadata({
	params,
}: UserLayoutProps): Promise<Metadata> {
	const { address } = await params;

	try {
		const res = await fetch(`${API_BASE}/api/v1/users/${address}`, {
			cache: "no-store",
		});

		if (!res.ok) {
			return { title: "User Not Found | HypeMint" };
		}

		const json = await res.json();
		const user = json?.data?.user;

		if (!user) {
			return { title: "User Not Found | HypeMint" };
		}

		const displayName = user.displayName || user.username || address;
		const title = `${displayName} | HypeMint`;
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
	} catch {
		return { title: "HypeMint" };
	}
}

export default function UserLayout({ children }: UserLayoutProps) {
	return <>{children}</>;
}
