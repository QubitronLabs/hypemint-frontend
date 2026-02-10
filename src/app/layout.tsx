import type { Metadata } from "next";
import {
	Plus_Jakarta_Sans,
	JetBrains_Mono,
	Space_Grotesk,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import {
	QueryProvider,
	DynamicProviderWrapper,
	UsernamePromptProvider,
	WagmiProvider,
	WebSocketProvider,
} from "@/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";
import { IsBrowser } from "@dynamic-labs/sdk-react-core";

/**
 * Font Configuration
 *
 * To change fonts globally, modify the font imports below.
 *
 * Popular font choices:
 * - Inter - Clean and modern
 * - Plus_Jakarta_Sans (current) - Friendly and professional
 * - Outfit - Modern and versatile
 * - DM_Sans - Elegant and minimal
 * - Manrope - Geometric and clean
 * - Urbanist - Minimal and trendy
 * - Sora - Geometric and contemporary
 */

// Primary font - used for body text and most UI elements
const primaryFont = Plus_Jakarta_Sans({
	variable: "--font-primary",
	subsets: ["latin"],
	display: "swap",
});

// Mono font - used for numbers, prices, addresses, code
const monoFont = JetBrains_Mono({
	variable: "--font-mono",
	subsets: ["latin"],
	display: "swap",
});

// Display font - used for hero headings and large titles
const displayFont = Space_Grotesk({
	variable: "--font-display",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "HypeMint - Memecoin Launchpad",
	description:
		"Launch and trade memecoins with instant bonding curves. The fastest way to create and discover new tokens.",
	keywords: [
		"memecoin",
		"crypto",
		"launchpad",
		"trading",
		"bonding curve",
		"defi",
	],
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{
				url: "/favicon-16x16.png",
				sizes: "16x16",
				type: "image/png",
			},
			{
				url: "/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
			},
			{
				url: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				url: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
		apple: [{ url: "/apple-touch-icon.png" }],
	},
	manifest: "/site.webmanifest",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<body
				className={`${primaryFont.variable} ${monoFont.variable} ${displayFont.variable} font-sans antialiased min-h-screen bg-background `}
				suppressHydrationWarning
			>
				<QueryProvider>
					<WagmiProvider>
						<DynamicProviderWrapper>
							<WebSocketProvider>
								<UsernamePromptProvider>
									{/* Sidebar Navigation */}
									<Sidebar />

									{/* Header */}
									<Header />
									<IsBrowser>
										{/* Main Content */}
										<main className="md:ml-17.5 w-full md:w-[calc(100vw-70px)] md:max-w-[calc(100vw-90px)] mx-auto pt-14 md:pt-16 min-h-screen overflow-x-clip px-3 md:px-0">
											{children}
										</main>
										{/* Footer */}
										<Footer />
									</IsBrowser>
									{/* Toast Notifications */}
									<Toaster richColors position="top-right" />
								</UsernamePromptProvider>
							</WebSocketProvider>
						</DynamicProviderWrapper>
					</WagmiProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
