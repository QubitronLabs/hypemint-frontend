/**
 * Wagmi Configuration for HypeMint
 *
 * Configures Wagmi with Polygon chain support and Ganache for local testing
 */

import { http, createConfig } from "wagmi";
import {
	Chain,
	mainnet,
	polygon,
	polygonAmoy,
	arbitrum,
	optimism,
	bsc,
	avalanche,
	linea,
	opBNB,
	bscTestnet,
	sepolia,
	arbitrumSepolia,
	optimismSepolia,
	avalancheFuji,
	lineaSepolia,
	baseSepolia,
} from "wagmi/chains";

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
const ETHEREUM_RPC_URL =
	process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://eth.merkle.io";
const POLYGON_RPC_URL =
	process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGON_AMOY_RPC_URL =
	process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ||
	"https://rpc-amoy.polygon.technology";
const ARBITRUM_RPC_URL =
	process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const OPTIMISM_RPC_URL =
	process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || "https://mainnet.optimism.io";
const BNB_RPC_URL =
	process.env.NEXT_PUBLIC_BNB_RPC_URL || "https://bsc-dataseed.binance.org";
const AVALANCHE_RPC_URL =
	process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";
const LINEA_RPC_URL =
	process.env.NEXT_PUBLIC_LINEA_RPC_URL || "https://rpc.linea.build";
const BNB_TESTNET_RPC_URL =
	process.env.NEXT_PUBLIC_BNB_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const SEPOLIA_RPC_URL =
	process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const ARBITRUM_SEPOLIA_RPC_URL =
	process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const OPTIMISM_SEPOLIA_RPC_URL =
	process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io";
const AVALANCHE_FUJI_RPC_URL =
	process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const LINEA_SEPOLIA_RPC_URL =
	process.env.NEXT_PUBLIC_LINEA_SEPOLIA_RPC_URL || "https://rpc.sepolia.linea.build";
const BASE_SEPOLIA_RPC_URL =
	process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const GANACHE_RPC_URL =
	process.env.NEXT_PUBLIC_GANACHE_RPC_URL || "http://127.0.0.1:7545";

// Check which chain to use (set NEXT_PUBLIC_CHAIN_MODE=local for Ganache)
const isLocalMode = process.env.NEXT_PUBLIC_CHAIN_MODE === "local";

// Create Wagmi config
export const wagmiConfig = createConfig({
	chains: isLocalMode
		? [ganache, polygonAmoy, polygon, mainnet, arbitrum, optimism, bsc, avalanche, linea, bscTestnet, sepolia, arbitrumSepolia, optimismSepolia, avalancheFuji, lineaSepolia, baseSepolia]
		: [polygon, mainnet, arbitrum, optimism, bsc, avalanche, linea, polygonAmoy, bscTestnet, sepolia, arbitrumSepolia, optimismSepolia, avalancheFuji, lineaSepolia, baseSepolia, ganache],
	transports: {
		[mainnet.id]: http(ETHEREUM_RPC_URL),
		[polygon.id]: http(POLYGON_RPC_URL),
		[polygonAmoy.id]: http(POLYGON_AMOY_RPC_URL),
		[arbitrum.id]: http(ARBITRUM_RPC_URL),
		[optimism.id]: http(OPTIMISM_RPC_URL),
		[bsc.id]: http(BNB_RPC_URL),
		[avalanche.id]: http(AVALANCHE_RPC_URL),
		[linea.id]: http(LINEA_RPC_URL),
		[bscTestnet.id]: http(BNB_TESTNET_RPC_URL),
		[sepolia.id]: http(SEPOLIA_RPC_URL),
		[arbitrumSepolia.id]: http(ARBITRUM_SEPOLIA_RPC_URL),
		[optimismSepolia.id]: http(OPTIMISM_SEPOLIA_RPC_URL),
		[avalancheFuji.id]: http(AVALANCHE_FUJI_RPC_URL),
		[lineaSepolia.id]: http(LINEA_SEPOLIA_RPC_URL),
		[baseSepolia.id]: http(BASE_SEPOLIA_RPC_URL),
		[ganache.id]: http(GANACHE_RPC_URL),
	},
	ssr: true, // Enable SSR for Next.js
});

// Export chain IDs for convenience
export const ETHEREUM_CHAIN_ID = mainnet.id;
export const POLYGON_CHAIN_ID = polygon.id;
export const POLYGON_AMOY_CHAIN_ID = polygonAmoy.id;
export const ARBITRUM_CHAIN_ID = arbitrum.id;
export const OPTIMISM_CHAIN_ID = optimism.id;
export const BNB_CHAIN_ID = bsc.id;
export const AVALANCHE_CHAIN_ID = avalanche.id;
export const LINEA_CHAIN_ID = linea.id;
export const GANACHE_CHAIN_ID = ganache.id;
export const OPBNB_CHAIN_ID = opBNB.id;
export const BNB_TESTNET_CHAIN_ID = bscTestnet.id;
export const SEPOLIA_CHAIN_ID = sepolia.id;
export const ARBITRUM_SEPOLIA_CHAIN_ID = arbitrumSepolia.id;
export const OPTIMISM_SEPOLIA_CHAIN_ID = optimismSepolia.id;
export const AVALANCHE_FUJI_CHAIN_ID = avalancheFuji.id;
export const LINEA_SEPOLIA_CHAIN_ID = lineaSepolia.id;
export const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id;

// Default chain based on mode
export const DEFAULT_CHAIN_ID = isLocalMode
	? GANACHE_CHAIN_ID
	: process.env.NODE_ENV === "production"
		? POLYGON_CHAIN_ID
		: POLYGON_AMOY_CHAIN_ID;

// Get chain by ID
export function getChain(chainId: number) {
	switch (chainId) {
		case mainnet.id:
			return mainnet;
		case polygon.id:
			return polygon;
		case polygonAmoy.id:
			return polygonAmoy;
		case arbitrum.id:
			return arbitrum;
		case optimism.id:
			return optimism;
		case bsc.id:
			return bsc;
		case avalanche.id:
			return avalanche;
		case linea.id:
			return linea;
		case bscTestnet.id:
			return bscTestnet;
		case sepolia.id:
			return sepolia;
		case arbitrumSepolia.id:
			return arbitrumSepolia;
		case optimismSepolia.id:
			return optimismSepolia;
		case avalancheFuji.id:
			return avalancheFuji;
		case lineaSepolia.id:
			return lineaSepolia;
		case baseSepolia.id:
			return baseSepolia;
		case ganache.id:
			return ganache;
		default:
			return isLocalMode ? ganache : polygonAmoy;
	}
}

// Fallback block explorer URLs (used when deployment store is not loaded)
const FALLBACK_EXPLORER_URLS: Record<number, string> = {
	[mainnet.id]: "https://etherscan.io",
	[polygon.id]: "https://polygonscan.com",
	[polygonAmoy.id]: "https://amoy.polygonscan.com",
	[arbitrum.id]: "https://arbiscan.io",
	[optimism.id]: "https://optimistic.etherscan.io",
	[bsc.id]: "https://bscscan.com",
	[avalanche.id]: "https://snowtrace.io",
	[linea.id]: "https://lineascan.build",
	[bscTestnet.id]: "https://testnet.bscscan.com",
	[sepolia.id]: "https://sepolia.etherscan.io",
	[arbitrumSepolia.id]: "https://sepolia.arbiscan.io",
	[optimismSepolia.id]: "https://sepolia-optimism.etherscan.io",
	[avalancheFuji.id]: "https://testnet.snowtrace.io",
	[lineaSepolia.id]: "https://sepolia.lineascan.build",
	[baseSepolia.id]: "https://sepolia.basescan.org",
	[ganache.id]: "", // No explorer for local
	901: "https://explorer.solana.com", // Solana devnet
};

/**
 * Get explorer base URL for a chain.
 * Checks the admin contract deployment store first, then falls back to hardcoded.
 */
export function getExplorerBaseUrl(chainId: number | string): string {
	const numericId = Number(chainId);
	// Dynamic: check contract deployments store
	try {
		const { useContractConfigStore } = require("@/hooks/useContractConfig");
		const store = useContractConfigStore.getState();
		if (store.isLoaded && store.deployments.length > 0) {
			const deployment = store.deployments.find(
				(d: any) => Number(d.chainId) === numericId && d.isActive,
			);
			if (deployment?.explorerUrl) {
				
				// Remove trailing slash if present
				return deployment.explorerUrl.replace(/\/$/, "");
			}
		}
	} catch {
		// Store not available (SSR), use fallback
	}
	return FALLBACK_EXPLORER_URLS[numericId] || "";
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
		10: "Optimism",
		56: "BNB Chain",
		97: "BNB Testnet",
		137: "Polygon",
		8453: "Base",
		42161: "Arbitrum",
		43113: "Avalanche Fuji",
		43114: "Avalanche",
		59141: "Linea Sepolia",
		59144: "Linea",
		80002: "Polygon Amoy",
		84532: "Base Sepolia",
		421614: "Arbitrum Sepolia",
		11155111: "Sepolia",
		11155420: "Optimism Sepolia",
		1337: "Ganache Local",
		901: "Solana Devnet",
	};
	return FALLBACK_NAMES[chainId] || `Chain ${chainId}`;
}

// Solana chain ID used in our system
export const SOLANA_DEVNET_CHAIN_ID = 901;

/**
 * Check if a chain is Solana-based.
 * Handles both string and number chainId (DB stores as varchar).
 */
export function isSolanaChain(chainId: number | string): boolean {
	return Number(chainId) === 901;
}

// Get transaction URL — supports both EVM and Solana chains
export function getTxUrl(
	txHash: string,
	chainId: number | string = DEFAULT_CHAIN_ID,
): string {
	const numericChainId = Number(chainId);
	const baseUrl = getExplorerBaseUrl(numericChainId);
	console.log({baseUrl});
	if (!baseUrl) return "";
	if (isSolanaChain(numericChainId)) {
		return `${baseUrl}/tx/${txHash}?cluster=devnet`;
	}
	return `${baseUrl}/tx/${txHash}`;
}

// Get address URL — supports both EVM and Solana chains
export function getAddressUrl(
	address: string,
	chainId: number | string = DEFAULT_CHAIN_ID,
): string {
	const numericChainId = Number(chainId);
	const baseUrl = getExplorerBaseUrl(numericChainId);
	if (!baseUrl) return "";
	if (isSolanaChain(numericChainId)) {
		return `${baseUrl}/address/${address}?cluster=devnet`;
	}
	return `${baseUrl}/address/${address}`;
}

// Get token URL — supports both EVM and Solana chains
export function getTokenUrl(
	address: string,
	chainId: number | string = DEFAULT_CHAIN_ID,
): string {
	const numericChainId = Number(chainId);
	const baseUrl = getExplorerBaseUrl(numericChainId);
	if (!baseUrl) return "";
	if (isSolanaChain(numericChainId)) {
		return `${baseUrl}/address/${address}?cluster=devnet`;
	}
	return `${baseUrl}/token/${address}`;
}

// Legacy export for backward compatibility
export const BLOCK_EXPLORER_URLS: Record<number, string> = FALLBACK_EXPLORER_URLS;

// Check if running in local mode
export const IS_LOCAL_MODE = isLocalMode;
