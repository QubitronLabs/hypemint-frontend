import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
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
                  <main className="ml-[70px] pt-16 min-h-screen">
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
