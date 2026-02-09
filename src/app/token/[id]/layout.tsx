import type { Metadata } from "next";

interface TokenLayoutProps {
	children: React.ReactNode;
	params: Promise<{ id: string }>;
}

const API_BASE =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function generateMetadata({
	params,
}: TokenLayoutProps): Promise<Metadata> {
	const { id } = await params;

	try {
		const res = await fetch(`${API_BASE}/api/v1/tokens/${id}`, {
			cache: "no-store",
		});

		if (!res.ok) {
			return { title: "Token Not Found | HypeMint" };
		}

		const json = await res.json();
		const token = json?.data?.token;

		if (!token) {
			return { title: "Token Not Found | HypeMint" };
		}

		const title = `${token.name} (${token.symbol}) | HypeMint`;
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
	} catch {
		return { title: "HypeMint" };
	}
}

export default function TokenLayout({ children }: TokenLayoutProps) {
	return <>{children}</>;
}
