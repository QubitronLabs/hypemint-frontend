/**
 * Wagmi Configuration for HypeMint
 *
 * Configures Wagmi with Polygon chain support
 */

import { http, createConfig } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";

// Polygon RPC URLs
const POLYGON_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
  "https://polygon-rpc.com";
const POLYGON_AMOY_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ||
  "https://rpc-amoy.polygon.technology";

// Create Wagmi config
export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  transports: {
    [polygon.id]: http(POLYGON_RPC_URL),
    [polygonAmoy.id]: http(POLYGON_AMOY_RPC_URL),
  },
  ssr: true, // Enable SSR for Next.js
});

// Export chain IDs for convenience
export const POLYGON_CHAIN_ID = polygon.id;
export const POLYGON_AMOY_CHAIN_ID = polygonAmoy.id;

// Default chain (use Amoy for development)
export const DEFAULT_CHAIN_ID =
  process.env.NODE_ENV === "production" ? POLYGON_CHAIN_ID : POLYGON_AMOY_CHAIN_ID;

// Get chain by ID
export function getChain(chainId: number) {
  switch (chainId) {
    case polygon.id:
      return polygon;
    case polygonAmoy.id:
      return polygonAmoy;
    default:
      return polygonAmoy;
  }
}

// Block explorer URLs
export const BLOCK_EXPLORER_URLS = {
  [polygon.id]: "https://polygonscan.com",
  [polygonAmoy.id]: "https://amoy.polygonscan.com",
} as const;

// Get transaction URL
export function getTxUrl(txHash: string, chainId: number = DEFAULT_CHAIN_ID): string {
  const baseUrl = BLOCK_EXPLORER_URLS[chainId as keyof typeof BLOCK_EXPLORER_URLS];
  return `${baseUrl}/tx/${txHash}`;
}

// Get address URL
export function getAddressUrl(address: string, chainId: number = DEFAULT_CHAIN_ID): string {
  const baseUrl = BLOCK_EXPLORER_URLS[chainId as keyof typeof BLOCK_EXPLORER_URLS];
  return `${baseUrl}/address/${address}`;
}

// Get token URL
export function getTokenUrl(address: string, chainId: number = DEFAULT_CHAIN_ID): string {
  const baseUrl = BLOCK_EXPLORER_URLS[chainId as keyof typeof BLOCK_EXPLORER_URLS];
  return `${baseUrl}/token/${address}`;
}
