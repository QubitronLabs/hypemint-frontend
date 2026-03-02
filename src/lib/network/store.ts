"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { NativeCurrency } from "@dynamic-labs/sdk-api-core";

// Chain type for multichain support
export type ChainType = "EVM" | "SOLANA";

// --- TYPE DEFINITIONS ---
export interface NetworkInfo {
	name: string;
	vanityName?: string;
}

export interface NetworkState {
	network: NetworkInfo | null;
	chainId: number | null;
	chainLogo: string | null;
	nativeCurrency: NativeCurrency | null;
	activeChainType: ChainType;
}

interface NetworkStoreState extends NetworkState {
	// Has hydration from localStorage completed?
	_hasHydrated: boolean;

	// Actions
	setNetworkData: (data: NetworkState) => void;
	clearNetworkData: () => void;
	setChainLogo: (logo: string) => void;
	setChainType: (chainType: ChainType) => void;
	setHasHydrated: (state: boolean) => void;
}

/**
 * Network Store - Manages global network/chain state
 *
 * This store tracks the currently selected blockchain network across the app.
 * It syncs with Dynamic.xyz wallet network changes and persists to localStorage.
 * Now includes activeChainType for multichain (EVM/Solana) support.
 */
export const useNetworkStore = create<NetworkStoreState>()(
	persist(
		(set) => ({
			network: null,
			chainId: null,
			chainLogo: null,
			nativeCurrency: null,
			activeChainType: "EVM" as ChainType,
			_hasHydrated: false,

			setNetworkData: (data) => { 
				set({
					network: data.network,
					chainId: data.chainId,
					chainLogo: data.chainLogo,
					nativeCurrency: data.nativeCurrency,
					activeChainType: data.activeChainType ?? "EVM",
				});
			},

			clearNetworkData: () => { 
				set({
					network: null,
					chainId: null,
					chainLogo: null,
					nativeCurrency: null,
					activeChainType: "EVM",
				});
			},

			setChainLogo: (logo) => {
				set({ chainLogo: logo });
			},

			setChainType: (chainType) => { 
				set({ activeChainType: chainType });
			},

			setHasHydrated: (state) => set({ _hasHydrated: state }),
		}),
		{
			name: "hypemint-network",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				network: state.network,
				chainId: state.chainId,
				chainLogo: state.chainLogo,
				nativeCurrency: state.nativeCurrency,
				activeChainType: state.activeChainType,
			}),
			onRehydrateStorage: () => (state) => {
				 
				state?.setHasHydrated(true);
			},
		},
	),
);

// Selector hooks for convenience
export const useNetwork = () => useNetworkStore((state) => state.network);
export const useChainId = () => useNetworkStore((state) => state.chainId);
export const useChainLogo = () => useNetworkStore((state) => state.chainLogo);
export const useNativeCurrency = () =>
	useNetworkStore((state) => state.nativeCurrency);
export const useActiveChainType = () =>
	useNetworkStore((state) => state.activeChainType);
export const useNetworkHasHydrated = () =>
	useNetworkStore((state) => state._hasHydrated);

/**
 * Get current network state outside of React
 */
export function getNetworkState(): NetworkState {
	const state = useNetworkStore.getState();
	return {
		network: state.network,
		chainId: state.chainId,
		chainLogo: state.chainLogo,
		nativeCurrency: state.nativeCurrency,
		activeChainType: state.activeChainType,
	};
}
