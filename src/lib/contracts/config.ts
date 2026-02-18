/**
 * HypeMint Contract Configuration
 *
 * Contract addresses and chain configuration.
 * Prefers dynamic config from backend (stored in useContractConfigStore),
 * falls back to hardcoded addresses when backend is unavailable.
 */

import { useContractConfigStore } from "@/hooks/useContractConfig";
import { useNetworkStore } from "@/lib/network/store";

// Polygon Mainnet Chain ID
export const POLYGON_CHAIN_ID = 137;

// Polygon Amoy Testnet Chain ID
export const POLYGON_AMOY_CHAIN_ID = 80002;

// Active chain (change for production) - used as fallback only
export const ACTIVE_CHAIN_ID = POLYGON_AMOY_CHAIN_ID;

/**
 * Get the active EVM chain ID dynamically from the backend contract deployments store.
 * If a walletChainId is provided (or detected from network store), prefer a
 * deployment for that chain so we use the same chain the user is on.
 * Falls back to ACTIVE_CHAIN_ID if the store hasn't loaded or has no active EVM deployment.
 */
export function getActiveEvmChainId(walletChainId?: number): number {
	// Auto-detect wallet chain from network store when not provided
	const effectiveWalletChain = walletChainId ?? useNetworkStore.getState().chainId ?? undefined;

	const store = useContractConfigStore.getState();
	if (store.isLoaded && store.deployments.length > 0) {
		// Prefer deployment that matches the wallet's current chain
		if (effectiveWalletChain) {
			const walletDeploy = store.deployments.find(
				(d) => d.chainId === effectiveWalletChain && d.chainType === "EVM" && d.isActive,
			);
			if (walletDeploy) return walletDeploy.chainId;
		}
		const evmDeployment = store.deployments.find(
			(d) => d.chainType === "EVM" && d.isActive,
		);
		if (evmDeployment) return evmDeployment.chainId;
	}
	return ACTIVE_CHAIN_ID;
}

/**
 * Get the active Solana chain ID from the backend contract deployments store.
 * Returns undefined if no active Solana deployment found.
 */
export function getActiveSolanaChainId(): number | undefined {
	const store = useContractConfigStore.getState();
	if (store.isLoaded && store.deployments.length > 0) {
		const solDeployment = store.deployments.find(
			(d) => d.chainType === "SOLANA" && d.isActive,
		);
		if (solDeployment) return solDeployment.chainId;
	}
	return undefined;
}

// Hardcoded fallback addresses - used when backend is unavailable
export const CONTRACT_ADDRESSES = {
	// Polygon Mainnet
	[POLYGON_CHAIN_ID]: {
		factory: "0x0000000000000000000000000000000000000000" as `0x${string}`,
		tokenImplementation:
			"0x0000000000000000000000000000000000000000" as `0x${string}`,
		bondingCurveImplementation:
			"0x0000000000000000000000000000000000000000" as `0x${string}`,
	},
	// Polygon Amoy Testnet - Deployed 2025-01-29
	[POLYGON_AMOY_CHAIN_ID]: {
		factory: "0xA29101b150cF7b77b1ffFf7f736d01289E5E0bB7" as `0x${string}`,
		tokenImplementation:
			"0x9B19609D2641575123756b352895034868076AC4" as `0x${string}`,
		bondingCurveImplementation:
			"0x98e025257E19f7900C092CFb80102f3275855b62" as `0x${string}`,
	},
} as const;

/**
 * Get contract address for a given chain.
 * First checks the dynamic backend config store, then falls back to hardcoded.
 */
export function getContractAddress(
	contract: "factory" | "tokenImplementation" | "bondingCurveImplementation",
	chainId?: number,
): `0x${string}` {
	const targetChainId = chainId ?? getActiveEvmChainId();

	// Try dynamic config from backend first
	const store = useContractConfigStore.getState();
	if (store.isLoaded && store.deployments.length > 0) {
		const deployment = store.deployments.find(
			(d) => d.chainId === targetChainId && d.isActive,
		);
		if (deployment) {
			const mapping: Record<string, string | null> = {
				factory: deployment.factoryAddress,
				tokenImplementation: deployment.tokenImplementationAddress,
				bondingCurveImplementation:
					deployment.bondingCurveImplementationAddress,
			};
			const addr = mapping[contract];
			if (addr) return addr as `0x${string}`;
		}
	}

	// Fallback to hardcoded
	const addresses =
		CONTRACT_ADDRESSES[targetChainId as keyof typeof CONTRACT_ADDRESSES];
	if (addresses) {
		return addresses[contract];
	}

	// Ultimate fallback
	return CONTRACT_ADDRESSES[ACTIVE_CHAIN_ID][contract];
}

/**
 * Get creation fee for a chain.
 * Checks dynamic config first, falls back to DEFAULT_CREATION_FEE.
 */
export function getCreationFeeForChain(chainId?: number): bigint {
	const targetChainId = chainId ?? getActiveEvmChainId();

	const store = useContractConfigStore.getState();
	if (store.isLoaded && store.deployments.length > 0) {
		const deployment = store.deployments.find(
			(d) => d.chainId === targetChainId && d.isActive,
		);
		if (deployment?.creationFee) {
			try {
				return BigInt(deployment.creationFee);
			} catch {
				// fall through
			}
		}
	}

	return DEFAULT_CREATION_FEE;
}

// Default creation fee in wei (0.01 MATIC)
export const DEFAULT_CREATION_FEE = BigInt("10000000000000000"); // 0.01 MATIC

// Default slippage tolerance (5%)
export const DEFAULT_SLIPPAGE_BPS = 500;

// Graduation threshold in USD
export const GRADUATION_THRESHOLD_USD = 69000;

// HypeBoost default configuration
export const HYPE_BOOST_DEFAULTS = {
	maxWalletPercent: 200, // 2%
	snipeProtectionBlocks: 5,
	vestingDuration: 3600, // 1 hour
	immediateUnlockPercent: 2500, // 25%
};

// Fee configuration (basis points)
export const FEE_CONFIG = {
	protocolFee: 100, // 1%
	creatorFee: 100, // 1%
};
