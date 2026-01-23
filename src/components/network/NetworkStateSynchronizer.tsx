"use client";

import { useEffect, useRef } from "react";
import {
    useDynamicContext,
    dynamicEvents,
    getNetwork,
} from "@dynamic-labs/sdk-react-core";
import type { EvmNetwork } from "@dynamic-labs/types";
import { useNetworkStore } from "@/lib/network";
import { useQueryClient } from "@tanstack/react-query";

// Helper type to safely access evmNetworks from the generic connector
interface EvmWalletConnector {
    evmNetworks?: EvmNetwork[];
    [key: string]: unknown;
}

/**
 * An invisible "bridge" component that synchronizes the user's current wallet
 * network state from the Dynamic SDK into our central Zustand store.
 *
 * This component:
 * 1. Listens to Dynamic.xyz wallet network change events
 * 2. Extracts network info (chainId, name, logo) from the wallet connector
 * 3. Updates the global network store
 * 4. Invalidates React Query caches so data refetches for the new chain
 *
 * Place this component inside DynamicContextProvider to ensure
 * all Dynamic hooks work correctly.
 */
export function NetworkStateSynchronizer() {
    const { primaryWallet } = useDynamicContext();
    const { setNetworkData, clearNetworkData } = useNetworkStore();
    const queryClient = useQueryClient();
    const lastChainIdRef = useRef<number | null>(null);

    useEffect(() => {
        const updateNetworkState = async () => {
            if (!primaryWallet?.connector) {
                console.log("[NetworkSync] No wallet connected, clearing network data");
                clearNetworkData();
                lastChainIdRef.current = null;
                return;
            }

            try {
                const chainId = await getNetwork(primaryWallet.connector);

                if (!chainId) {
                    console.warn("[NetworkSync] Could not determine chain ID from wallet");
                    clearNetworkData();
                    return;
                }

                const numericChainId = Number(chainId);

                // Skip if chain hasn't changed
                if (lastChainIdRef.current === numericChainId) {
                    return;
                }

                console.log(`[NetworkSync] Chain changed: ${lastChainIdRef.current} -> ${numericChainId}`);
                lastChainIdRef.current = numericChainId;

                // Cast the generic connector to access evmNetworks
                const connector = primaryWallet.connector as unknown as EvmWalletConnector;

                // Find the full network configuration from the connector's list
                const currentNetworkConfig = connector.evmNetworks?.find(
                    (net) => net.chainId === numericChainId
                );

                if (!currentNetworkConfig) {
                    console.warn(`[NetworkSync] No network config found for chain ID ${numericChainId}`);
                    setNetworkData({
                        network: { name: `Chain ${numericChainId}` },
                        chainId: numericChainId,
                        chainLogo: null,
                    });
                } else {
                    // Use vanityName if available, otherwise fall back to name
                    const networkName = currentNetworkConfig.vanityName || currentNetworkConfig.name;
                    const chainLogo = currentNetworkConfig.iconUrls?.[0] || null;

                    setNetworkData({
                        network: {
                            name: networkName,
                            vanityName: currentNetworkConfig.vanityName,
                        },
                        chainId: numericChainId,
                        chainLogo,
                    });

                    console.log(`[NetworkSync] Network updated: ${networkName} (${numericChainId})`);
                }

                // --- CRITICAL: Invalidate all queries to refetch data for new chain ---
                // This ensures all components get fresh data for the new network
                console.log("[NetworkSync] Invalidating all queries for chain change...");
                queryClient.invalidateQueries();

            } catch (error) {
                console.error("[NetworkSync] Failed to update network state:", error);
                clearNetworkData();
            }
        };

        // Handler for network change events
        const handleNetworkChange = () => {
            console.log("[NetworkSync] Network change event received");
            updateNetworkState();
        };

        // Subscribe to Dynamic.xyz network change events
        dynamicEvents.on("primaryWalletNetworkChanged", handleNetworkChange);

        // Initial network state sync
        updateNetworkState();

        // Cleanup listener on unmount
        return () => {
            dynamicEvents.off("primaryWalletNetworkChanged", handleNetworkChange);
        };
    }, [primaryWallet, setNetworkData, clearNetworkData, queryClient]);

    // This component renders nothing - it's just a state synchronizer
    return null;
}
