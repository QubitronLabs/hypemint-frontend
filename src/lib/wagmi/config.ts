/**
 * Wagmi Configuration for HypeMint
 *
 * Configures Wagmi with Polygon chain support and Ganache for local testing
 */

import { http, createConfig } from "wagmi";
import { Chain, polygon, polygonAmoy, opBNB } from "wagmi/chains";

// Ganache Local Development Chain
export const ganache: Chain = {
	id: 1337,
	name: "Ganache Local",
	nativeCurrency: {
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
	},
	rpcUrls: {
		default: {
			http: [
				process.env.NEXT_PUBLIC_GANACHE_RPC_URL ||
					"http://127.0.0.1:7545",
			],
		},
		public: {
			http: [
				process.env.NEXT_PUBLIC_GANACHE_RPC_URL ||
					"http://127.0.0.1:7545",
			],
		},
	},
	testnet: true,
};

// RPC URLs from environment
const POLYGON_RPC_URL =
	process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGON_AMOY_RPC_URL =
	process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ||
	"https://rpc-amoy.polygon.technology";
const GANACHE_RPC_URL =
	process.env.NEXT_PUBLIC_GANACHE_RPC_URL || "http://127.0.0.1:7545";

// Check which chain to use (set NEXT_PUBLIC_CHAIN_MODE=local for Ganache)
const isLocalMode = process.env.NEXT_PUBLIC_CHAIN_MODE === "local";

// Create Wagmi config
export const wagmiConfig = createConfig({
	chains: isLocalMode
		? [ganache, polygonAmoy, polygon]
		: [polygon, polygonAmoy, ganache],
	transports: {
		[polygon.id]: http(POLYGON_RPC_URL),
		[polygonAmoy.id]: http(POLYGON_AMOY_RPC_URL),
		[ganache.id]: http(GANACHE_RPC_URL),
	},
	ssr: true, // Enable SSR for Next.js
});

// Export chain IDs for convenience
export const POLYGON_CHAIN_ID = polygon.id;
export const POLYGON_AMOY_CHAIN_ID = polygonAmoy.id;
export const GANACHE_CHAIN_ID = ganache.id;
export const OPBNB_CHAIN_ID = opBNB.id;

// Default chain based on mode
export const DEFAULT_CHAIN_ID = isLocalMode
	? GANACHE_CHAIN_ID
	: process.env.NODE_ENV === "production"
		? POLYGON_CHAIN_ID
		: POLYGON_AMOY_CHAIN_ID;

// Get chain by ID
export function getChain(chainId: number) {
	switch (chainId) {
		case polygon.id:
			return polygon;
		case polygonAmoy.id:
			return polygonAmoy;
		case ganache.id:
			return ganache;
		default:
			return isLocalMode ? ganache : polygonAmoy;
	}
}

// Fallback block explorer URLs (used when deployment store is not loaded)
const FALLBACK_EXPLORER_URLS: Record<number, string> = {
	[polygon.id]: "https://polygonscan.com",
	[polygonAmoy.id]: "https://amoy.polygonscan.com",
	[ganache.id]: "", // No explorer for local
	901: "https://explorer.solana.com", // Solana devnet
};

/**
 * Get explorer base URL for a chain.
 * Checks the admin contract deployment store first, then falls back to hardcoded.
 */
export function getExplorerBaseUrl(chainId: number): string {
	// Dynamic: check contract deployments store
	try {
		const { useContractConfigStore } = require("@/hooks/useContractConfig");
		const store = useContractConfigStore.getState();
		if (store.isLoaded && store.deployments.length > 0) {
			const deployment = store.deployments.find(
				(d: any) => d.chainId === chainId && d.isActive,
			);
			if (deployment?.explorerUrl) {
				// Remove trailing slash if present
				return deployment.explorerUrl.replace(/\/$/, "");
			}
		}
	} catch {
		// Store not available (SSR), use fallback
	}
	return FALLBACK_EXPLORER_URLS[chainId] || "";
}

/**
 * Get chain display name for a chain ID.
 * Checks the admin contract deployment store first, then falls back to known names.
 */
export function getChainDisplayName(chainId: number): string {
	// Dynamic: check contract deployments store
	try {
		const { useContractConfigStore } = require("@/hooks/useContractConfig");
		const store = useContractConfigStore.getState();
		if (store.isLoaded && store.deployments.length > 0) {
			const deployment = store.deployments.find(
				(d: any) => d.chainId === chainId && d.isActive,
			);
			if (deployment?.chainName) return deployment.chainName;
		}
	} catch {
		// Store not available (SSR), use fallback
	}
	const FALLBACK_NAMES: Record<number, string> = {
		1: "Ethereum",
		137: "Polygon",
		80002: "Polygon Amoy",
		8453: "Base",
		1337: "Ganache Local",
		901: "Solana Devnet",
	};
	return FALLBACK_NAMES[chainId] || `Chain ${chainId}`;
}

// Solana chain ID used in our system
export const SOLANA_DEVNET_CHAIN_ID = 901;

/**
 * Check if a chain is Solana-based
 */
export function isSolanaChain(chainId: number): boolean {
	return chainId === 901;
}

// Get transaction URL — supports both EVM and Solana chains
export function getTxUrl(
	txHash: string,
	chainId: number = DEFAULT_CHAIN_ID,
): string {
	const baseUrl = getExplorerBaseUrl(chainId);
	if (!baseUrl) return "";
	if (isSolanaChain(chainId)) {
		return `${baseUrl}/tx/${txHash}?cluster=devnet`;
	}
	return `${baseUrl}/tx/${txHash}`;
}

// Get address URL — supports both EVM and Solana chains
export function getAddressUrl(
	address: string,
	chainId: number = DEFAULT_CHAIN_ID,
): string {
	const baseUrl = getExplorerBaseUrl(chainId);
	if (!baseUrl) return "";
	if (isSolanaChain(chainId)) {
		return `${baseUrl}/address/${address}?cluster=devnet`;
	}
	return `${baseUrl}/address/${address}`;
}

// Get token URL — supports both EVM and Solana chains
export function getTokenUrl(
	address: string,
	chainId: number = DEFAULT_CHAIN_ID,
): string {
	const baseUrl = getExplorerBaseUrl(chainId);
	if (!baseUrl) return "";
	if (isSolanaChain(chainId)) {
		return `${baseUrl}/address/${address}?cluster=devnet`;
	}
	return `${baseUrl}/token/${address}`;
}

// Legacy export for backward compatibility
export const BLOCK_EXPLORER_URLS: Record<number, string> = FALLBACK_EXPLORER_URLS;

// Check if running in local mode
export const IS_LOCAL_MODE = isLocalMode;
