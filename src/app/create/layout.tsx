import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Create Token | HypeMint",
	description:
		"Launch your own memecoin on HypeMint with instant bonding curves. Set up your token name, symbol, and start trading in seconds.",
	openGraph: {
		title: "Create Token | HypeMint",
		description:
			"Launch your own memecoin on HypeMint with instant bonding curves.",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Create Token | HypeMint",
		description:
			"Launch your own memecoin on HypeMint with instant bonding curves.",
	},
};

export default function CreateLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
