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
import {
	isSolanaWallet,
	type SolanaWalletConnector,
} from "@dynamic-labs/solana";

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
	const { setNetworkData, clearNetworkData } = useNetworkStore();
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

				// For Solana wallets, detect the cluster (devnet vs mainnet)
				// using the Dynamic.xyz connector's getNetwork() API.
				//
				// Dynamic.xyz network IDs (from getSelectedNetwork().chainId):
				//   Mainnet Beta: 101
				//   Devnet:       103
				if (walletChainType === "SOLANA") {
					let solanaChainId = SOLANA_DEVNET_CHAIN_ID; // default devnet

					try {
						if (primaryWallet && isSolanaWallet(primaryWallet)) {
							const connector =
								primaryWallet.connector as unknown as SolanaWalletConnector;

							// Primary source of truth: getNetwork() returns the wallet's actual cluster.
							// This is async and reflects the real wallet state.
							let clusterResolved = false;
							try {
								const clusterName = await connector.getNetwork();
								console.log(
									`[NetworkSync] Solana cluster from getNetwork(): "${clusterName}"`,
								);

								if (
									clusterName === "mainnet-beta" ||
									clusterName === "mainnet"
								) {
									solanaChainId = 900;
									clusterResolved = true;
								} else if (clusterName === "testnet") {
									solanaChainId = 902;
									clusterResolved = true;
								} else if (clusterName === "devnet") {
									solanaChainId = 901;
									clusterResolved = true;
								}
							} catch (err) {
								console.warn("[NetworkSync] getNetwork() failed, using fallback:", err);
							}

							// Fallback ONLY: use Dynamic's numeric network ID when
							// getNetwork() didn't resolve. Do NOT use as override —
							// getSelectedNetwork() is sync and can return stale data
							// during network transitions, causing flip-flop.
							if (!clusterResolved) {
								const selectedNetwork = connector.getSelectedNetwork();
								if (selectedNetwork) {
									const networkId = String(selectedNetwork.chainId);
									console.log(
										`[NetworkSync] Solana fallback networkId: "${networkId}"`,
									);
									if (networkId === "101") {
										solanaChainId = 900; // mainnet-beta
									} else if (networkId === "103") {
										solanaChainId = 901; // devnet
									}
								}
							}
						}
					} catch (err) {
						console.warn("[NetworkSync] Solana network detection failed:", err);
						// Fall back to devnet
					}

					// Skip if Solana chain hasn't changed — prevents flip-flop
					// when useEffect re-fires due to primaryWallet ref changes
					if (lastChainIdRef.current === solanaChainId) {
						return;
					}

					const isMainnet = solanaChainId === 900;
					console.log(
						`[NetworkSync] Solana chain resolved: ${solanaChainId} (${isMainnet ? "mainnet" : "devnet"})`,
					);

					setNetworkData({
						network: {
							name: isMainnet ? "Solana" : "Solana Devnet",
							vanityName: isMainnet ? "Solana" : "Solana Devnet",
						},
						chainId: solanaChainId,
						chainLogo: "/chains/solana.svg",
						nativeCurrency: {
							name: "SOL",
							symbol: "SOL",
							decimals: 9,
						},
						activeChainType: "SOLANA",
					});
					lastChainIdRef.current = solanaChainId;
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
	}, [primaryWallet, sdkHasLoaded, setNetworkData, clearNetworkData, queryClient]);

	// This component renders nothing - it's just a state synchronizer
	return null;
}
