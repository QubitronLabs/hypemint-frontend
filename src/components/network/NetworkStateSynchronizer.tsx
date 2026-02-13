"use client";

import { useEffect, useRef } from "react";
import {
	useDynamicContext,
	dynamicEvents,
	getNetwork,
} from "@dynamic-labs/sdk-react-core";
import type { EvmNetwork } from "@dynamic-labs/types";
import { useNetworkStore, type ChainType } from "@/lib/network";
import { useQueryClient } from "@tanstack/react-query";
import { SOLANA_DEVNET_CHAIN_ID } from "@/lib/wagmi/config";

// Helper type to safely access evmNetworks from the generic connector
export interface EvmWalletConnector {
	evmNetworks?: EvmNetwork[];
	[key: string]: unknown;
}

/**
 * Detect chain type from the wallet's chain/connector
 *
 * Dynamic.xyz exposes wallet.chain for distinguishing EVM vs Solana wallets.
 */
function detectChainType(wallet: { chain?: string } | null): ChainType {
	if (!wallet) return "EVM";

	// Dynamic.xyz uses "SOL" or "solana" for Solana wallets
	const chain = (wallet as { chain?: string }).chain?.toLowerCase();
	if (chain === "sol" || chain === "solana") {
		return "SOLANA";
	}

	return "EVM";
}

/**
 * An invisible "bridge" component that synchronizes the user's current wallet
 * network state from the Dynamic SDK into our central Zustand store.
 *
 * This component:
 * 1. Listens to Dynamic.xyz wallet network change events
 * 2. Extracts network info (chainId, name, logo) from the wallet connector
 * 3. Determines if the wallet is EVM or Solana-based (sets chainType)
 * 4. Updates the global network store
 * 5. Invalidates React Query caches so data refetches for the new chain
 *
 * Place this component inside DynamicContextProvider to ensure
 * all Dynamic hooks work correctly.
 */
export function NetworkStateSynchronizer() {
	const { primaryWallet, sdkHasLoaded } = useDynamicContext();
	const { setNetworkData, clearNetworkData, setChainType } = useNetworkStore();
	const queryClient = useQueryClient();
	const lastChainIdRef = useRef<number | null>(null);

	useEffect(() => {
		// Wait for SDK to be fully loaded before accessing wallet state
		if (!sdkHasLoaded) return;

		const updateNetworkState = async () => {
			if (!primaryWallet?.connector) {
				console.log(
					"[NetworkSync] No wallet connected, clearing network data",
				);
				clearNetworkData();
				lastChainIdRef.current = null;
				return;
			}

			try {
				// Detect chain type from the primary wallet
				const walletChainType = detectChainType(primaryWallet as { chain?: string });
				setChainType(walletChainType);

				console.log(
					`[NetworkSync] Wallet chain type detected: ${walletChainType}`,
				);

				// For Solana wallets, we handle network info differently
				if (walletChainType === "SOLANA") {
					setNetworkData({
						network: { name: "Solana", vanityName: "Solana Devnet" },
						chainId: SOLANA_DEVNET_CHAIN_ID,
						chainLogo: "/chains/solana.svg",
						nativeCurrency: {
							name: "SOL",
							symbol: "SOL",
							decimals: 9,
						},
						activeChainType: "SOLANA",
					});
					lastChainIdRef.current = SOLANA_DEVNET_CHAIN_ID;

					console.log("[NetworkSync] Invalidating all queries for Solana switch...");
					queryClient.invalidateQueries();
					return;
				}

				// EVM wallet logic (existing behavior)
				const chainId = await getNetwork(primaryWallet.connector);

				if (!chainId) {
					console.warn(
						"[NetworkSync] Could not determine chain ID from wallet",
					);
					clearNetworkData();
					return;
				}

				const numericChainId = Number(chainId);

				// Skip if chain hasn't changed
				if (lastChainIdRef.current === numericChainId) {
					return;
				}

				console.log(
					`[NetworkSync] Chain changed: ${lastChainIdRef.current} -> ${numericChainId}`,
				);
				lastChainIdRef.current = numericChainId;

				// Cast the generic connector to access evmNetworks
				const connector =
					primaryWallet.connector as unknown as EvmWalletConnector;

				// Find the full network configuration from the connector's list
				const currentNetworkConfig = connector.evmNetworks?.find(
					(net) => net.chainId === numericChainId,
				);

				if (!currentNetworkConfig) {
					console.warn(
						`[NetworkSync] No network config found for chain ID ${numericChainId}`,
					);
					setNetworkData({
						network: { name: `Chain ${numericChainId}` },
						chainId: numericChainId,
						chainLogo: null,
						nativeCurrency: null,
						activeChainType: "EVM",
					});
				} else {
					// Use vanityName if available, otherwise fall back to name
					const networkName =
						currentNetworkConfig.vanityName ||
						currentNetworkConfig.name;
					const chainLogo =
						currentNetworkConfig.iconUrls?.[0] || null;

					// Extract native currency from network config
					const nativeCurrency = currentNetworkConfig.nativeCurrency
						? {
								name: currentNetworkConfig.nativeCurrency.name,
								symbol: currentNetworkConfig.nativeCurrency
									.symbol,
								decimals:
									currentNetworkConfig.nativeCurrency
										.decimals,
								iconUrl:
									currentNetworkConfig.nativeCurrency.iconUrl,
							}
						: null;

					setNetworkData({
						network: {
							name: networkName,
							vanityName: currentNetworkConfig.vanityName,
						},
						chainId: numericChainId,
						chainLogo,
						nativeCurrency,
						activeChainType: "EVM",
					});

					console.log(
						`[NetworkSync] Network updated: ${networkName} (${numericChainId}), native: ${nativeCurrency?.symbol || "unknown"}`,
					);
				}

				// --- CRITICAL: Invalidate all queries to refetch data for new chain ---
				// This ensures all components get fresh data for the new network
				console.log(
					"[NetworkSync] Invalidating all queries for chain change...",
				);
				queryClient.invalidateQueries();
			} catch (error) {
				console.error(
					"[NetworkSync] Failed to update network state:",
					error,
				);
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
			dynamicEvents.off(
				"primaryWalletNetworkChanged",
				handleNetworkChange,
			);
		};
	}, [primaryWallet, sdkHasLoaded, setNetworkData, clearNetworkData, setChainType, queryClient]);

	// This component renders nothing - it's just a state synchronizer
	return null;
}
