/**
 * Wagmi Configuration for HypeMint
 *
 * Uses the backend RPC proxy (POST /api/v1/rpc/:chainId) as the primary
 * transport so Alchemy API keys stay server-side.  Falls back to public
 * RPCs if the proxy is unreachable.
 */

import { http, fallback, createConfig } from "wagmi";
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
	base,
	zksync,
} from "wagmi/chains";

// Backend API URL — RPC proxy lives at POST ${API_URL}/api/v1/rpc/:chainId
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

// ---------------------------------------------------------------------------
//  Transport helpers
// ---------------------------------------------------------------------------
// Public RPCs as fallbacks (no API key needed — free, lower rate limits)
const PUBLIC_RPCS: Record<number, string> = {
	[mainnet.id]: "https://eth.merkle.io",
	[polygon.id]: "https://polygon.drpc.org",
	[polygonAmoy.id]: "https://rpc-amoy.polygon.technology",
	[arbitrum.id]: "https://arb1.arbitrum.io/rpc",
	[optimism.id]: "https://mainnet.optimism.io",
	[bsc.id]: "https://bsc-dataseed.binance.org",
	[avalanche.id]: "https://api.avax.network/ext/bc/C/rpc",
	[linea.id]: "https://rpc.linea.build",
	[bscTestnet.id]: "https://data-seed-prebsc-1-s1.binance.org:8545",
	[sepolia.id]: "https://rpc.sepolia.org",
	[arbitrumSepolia.id]: "https://sepolia-rollup.arbitrum.io/rpc",
	[optimismSepolia.id]: "https://sepolia.optimism.io",
	[avalancheFuji.id]: "https://api.avax-test.network/ext/bc/C/rpc",
	[lineaSepolia.id]: "https://rpc.sepolia.linea.build",
	[baseSepolia.id]: "https://sepolia.base.org",
	[base.id]: "https://mainnet.base.org",
	[zksync.id]: "https://mainnet.era.zksync.io",
};

/**
 * Build transport for a chain: backend proxy → public RPC fallback.
 * For Ganache, always use the local URL directly.
 */
function proxyTransport(chainId: number) {
	if (chainId === ganache.id) {
		return http(process.env.NEXT_PUBLIC_GANACHE_RPC_URL || "http://127.0.0.1:7545");
	}
	const publicRpc = PUBLIC_RPCS[chainId];
	const proxyUrl = `${API_URL}/api/v1/rpc/${chainId}`;
	return publicRpc ? fallback([http(proxyUrl), http(publicRpc)]) : http(proxyUrl);
}

// Check which chain to use (set NEXT_PUBLIC_CHAIN_MODE=local for Ganache)
const isLocalMode = process.env.NEXT_PUBLIC_CHAIN_MODE === "local";

// Create Wagmi config
export const wagmiConfig = createConfig({
	chains: isLocalMode
		? [ganache, polygonAmoy, polygon, mainnet, arbitrum, optimism, bsc, avalanche, linea, base, zksync, bscTestnet, sepolia, arbitrumSepolia, optimismSepolia, avalancheFuji, lineaSepolia, baseSepolia]
		: [polygon, mainnet, arbitrum, optimism, bsc, avalanche, linea, base, zksync, polygonAmoy, bscTestnet, sepolia, arbitrumSepolia, optimismSepolia, avalancheFuji, lineaSepolia, baseSepolia, ganache],
	transports: {
		[mainnet.id]: proxyTransport(mainnet.id),
		[polygon.id]: proxyTransport(polygon.id),
		[polygonAmoy.id]: proxyTransport(polygonAmoy.id),
		[arbitrum.id]: proxyTransport(arbitrum.id),
		[optimism.id]: proxyTransport(optimism.id),
		[bsc.id]: proxyTransport(bsc.id),
		[avalanche.id]: proxyTransport(avalanche.id),
		[linea.id]: proxyTransport(linea.id),
		[bscTestnet.id]: proxyTransport(bscTestnet.id),
		[sepolia.id]: proxyTransport(sepolia.id),
		[arbitrumSepolia.id]: proxyTransport(arbitrumSepolia.id),
		[optimismSepolia.id]: proxyTransport(optimismSepolia.id),
		[avalancheFuji.id]: proxyTransport(avalancheFuji.id),
		[lineaSepolia.id]: proxyTransport(lineaSepolia.id),
		[baseSepolia.id]: proxyTransport(baseSepolia.id),
		[base.id]: proxyTransport(base.id),
		[zksync.id]: proxyTransport(zksync.id),
		[ganache.id]: proxyTransport(ganache.id),
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
		case base.id:
			return base;
		case zksync.id:
			return zksync;
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
	[base.id]: "https://basescan.org",
	[zksync.id]: "https://explorer.zksync.io",
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
		900: "Solana Mainnet",
		901: "Solana Devnet",
	};
	return FALLBACK_NAMES[chainId] || `Chain ${chainId}`;
}

// Solana chain IDs used in our system
export const SOLANA_DEVNET_CHAIN_ID = 901;
export const SOLANA_MAINNET_CHAIN_ID = 900;

/**
 * Check if a chain is Solana-based.
 * Handles both string and number chainId (DB stores as varchar).
 * 900 = mainnet, 901 = devnet, 902 = testnet
 */
export function isSolanaChain(chainId: number | string): boolean {
	const id = Number(chainId);
	return id >= 900 && id <= 999;
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
		const cluster = numericChainId === 900 ? "" : "?cluster=devnet";
		return `${baseUrl}/tx/${txHash}${cluster}`;
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
		const cluster = numericChainId === 900 ? "" : "?cluster=devnet";
		return `${baseUrl}/address/${address}${cluster}`;
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
		const cluster = numericChainId === 900 ? "" : "?cluster=devnet";
		return `${baseUrl}/address/${address}${cluster}`;
	}
	return `${baseUrl}/token/${address}`;
}

// Legacy export for backward compatibility
export const BLOCK_EXPLORER_URLS: Record<number, string> = FALLBACK_EXPLORER_URLS;

// Check if running in local mode
export const IS_LOCAL_MODE = isLocalMode;
