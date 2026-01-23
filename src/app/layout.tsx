import type { Metadata } from "next";
import {
	Plus_Jakarta_Sans,
	JetBrains_Mono,
	Space_Grotesk,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import {
	QueryProvider,
	DynamicProvider,
	UsernamePromptProvider,
	WagmiProvider,
	WebSocketProvider,
} from "@/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import "./globals.css";

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
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body
				className={`${primaryFont.variable} ${monoFont.variable} ${displayFont.variable} font-sans antialiased min-h-screen bg-background`}
			>
				<QueryProvider>
					<WagmiProvider>
						<DynamicProvider>
							<WebSocketProvider>
								<UsernamePromptProvider>
									{/* Sidebar Navigation */}
									<Sidebar />

									{/* Header */}
									<Header />

									{/* Main Content */}
									<main className="ml-[70px] w-[calc(100vw-70px)] max-w-[calc(100vw-90px)] mx-auto pt-16 min-h-screen overflow-x-clip">
										{children}
									</main>

									{/* Toast Notifications */}
									<Toaster
										position="bottom-right"
										toastOptions={{
											style: {
												background: "#111",
												border: "1px solid #222",
												color: "#fafafa",
											},
										}}
									/>
								</UsernamePromptProvider>
							</WebSocketProvider>
						</DynamicProvider>
					</WagmiProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
