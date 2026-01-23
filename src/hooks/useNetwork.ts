'use client';

import { useCallback } from 'react';
import { useNetworkStore, useChainId, useNetwork, useChainLogo, type NetworkInfo, type NetworkState } from '@/lib/network';

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
    const isOnChain = useCallback((targetChainId: number): boolean => {
        return chainId === targetChainId;
    }, [chainId]);

    /**
     * Get network display name (prefers vanityName)
     */
    const getNetworkName = useCallback((): string => {
        if (!network) return 'Unknown Network';
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

export type { NetworkInfo, NetworkState };
