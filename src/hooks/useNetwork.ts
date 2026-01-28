"use client";

import { useCallback } from "react";
import {
	useNetworkStore,
	useChainId,
	useNetwork,
	useChainLogo,
	useNativeCurrency as useNativeCurrencyFromStore,
	type NetworkInfo,
	type NetworkState,
} from "@/lib/network";
import type { NativeCurrency } from "@dynamic-labs/sdk-api-core";

// Default native currency when network is not connected
const DEFAULT_NATIVE_CURRENCY: NativeCurrency = {
	name: "POL",
	symbol: "POL",
	decimals: 18,
};

/**
 * Hook to access and manage global network state
 *
 * This hook provides:
 * - Current chain ID
 * - Network info (name, vanityName)
 * - Chain logo URL
 * - Actions to update network state
 *
 * The network state is synced automatically by NetworkStateSynchronizer
 * whenever the user changes their wallet's network.
 */
export function useGlobalNetwork() {
	const chainId = useChainId();
	const network = useNetwork();
	const chainLogo = useChainLogo();
	const { setNetworkData, clearNetworkData } = useNetworkStore();

	/**
	 * Check if the user is on a specific chain
	 */
	const isOnChain = useCallback(
		(targetChainId: number): boolean => {
			return chainId === targetChainId;
		},
		[chainId],
	);

	/**
	 * Get network display name (prefers vanityName)
	 */
	const getNetworkName = useCallback((): string => {
		if (!network) return "Unknown Network";
		return network.vanityName || network.name;
	}, [network]);

	return {
		// State
		chainId,
		network,
		chainLogo,
		isConnected: chainId !== null,

		// Computed
		networkName: getNetworkName(),

		// Actions
		setNetworkData,
		clearNetworkData,

		// Helpers
		isOnChain,
		getNetworkName,
	};
}

/**
 * Hook to get just the chain ID (for simpler use cases)
 */
export function useActiveChainId(): number | null {
	return useChainId();
}

/**
 * Hook to check if connected to a specific chain
 */
export function useIsOnChain(targetChainId: number): boolean {
	const chainId = useChainId();
	return chainId === targetChainId;
}

/**
 * Hook to get native currency info for the current chain
 *
 * Returns the native currency symbol, name, and decimals from Dynamic Labs SDK.
 * This data is synced by NetworkStateSynchronizer when the network changes.
 * Falls back to POL if no network is connected.
 */
export function useNativeCurrency(): NativeCurrency {
	const nativeCurrency = useNativeCurrencyFromStore();
	return nativeCurrency || DEFAULT_NATIVE_CURRENCY;
}

/**
 * Hook to get just the native currency symbol (shorthand)
 *
 * Returns the symbol like "ETH", "POL", "BNB", etc.
 * Updates automatically when the network changes via NetworkStateSynchronizer.
 */
export function useNativeCurrencySymbol(): string {
	const nativeCurrency = useNativeCurrencyFromStore();
	return nativeCurrency?.symbol || DEFAULT_NATIVE_CURRENCY.symbol;
}

export type { NetworkInfo, NetworkState, NativeCurrency };
