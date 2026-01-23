'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- TYPE DEFINITIONS ---
export interface NetworkInfo {
    name: string;
    vanityName?: string;
}

export interface NetworkState {
    network: NetworkInfo | null;
    chainId: number | null;
    chainLogo: string | null;
}

interface NetworkStoreState extends NetworkState {
    // Has hydration from localStorage completed?
    _hasHydrated: boolean;

    // Actions
    setNetworkData: (data: NetworkState) => void;
    clearNetworkData: () => void;
    setChainLogo: (logo: string) => void;
    setHasHydrated: (state: boolean) => void;
}

/**
 * Network Store - Manages global network/chain state
 *
 * This store tracks the currently selected blockchain network across the app.
 * It syncs with Dynamic.xyz wallet network changes and persists to localStorage.
 */
export const useNetworkStore = create<NetworkStoreState>()(
    persist(
        (set) => ({
            network: null,
            chainId: null,
            chainLogo: null,
            _hasHydrated: false,

            setNetworkData: (data) => {
                console.log('[Network] Setting network data:', data);
                set({
                    network: data.network,
                    chainId: data.chainId,
                    chainLogo: data.chainLogo,
                });
            },

            clearNetworkData: () => {
                console.log('[Network] Clearing network data');
                set({
                    network: null,
                    chainId: null,
                    chainLogo: null,
                });
            },

            setChainLogo: (logo) => {
                set({ chainLogo: logo });
            },

            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'hypemint-network',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                network: state.network,
                chainId: state.chainId,
                chainLogo: state.chainLogo,
            }),
            onRehydrateStorage: () => (state) => {
                console.log('[Network] Hydration complete, chainId:', state?.chainId || 'none');
                state?.setHasHydrated(true);
            },
        }
    )
);

// Selector hooks for convenience
export const useNetwork = () => useNetworkStore((state) => state.network);
export const useChainId = () => useNetworkStore((state) => state.chainId);
export const useChainLogo = () => useNetworkStore((state) => state.chainLogo);
export const useNetworkHasHydrated = () => useNetworkStore((state) => state._hasHydrated);

/**
 * Get current network state outside of React
 */
export function getNetworkState(): NetworkState {
    const state = useNetworkStore.getState();
    return {
        network: state.network,
        chainId: state.chainId,
        chainLogo: state.chainLogo,
    };
}
