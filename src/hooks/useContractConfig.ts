/**
 * Contract Config Hook
 *
 * Fetches and caches contract deployment configuration from the backend.
 * Replaces the hardcoded CONTRACT_ADDRESSES in config.ts.
 *
 * Usage:
 *   const { getFactoryAddress, getCreationFee, activeDeployment } = useContractConfig();
 */

"use client";

import { useEffect, useMemo, useCallback } from "react";
import { create } from "zustand";
import {
	getActiveContractDeployments,
	type ContractDeploymentConfig,
} from "@/lib/api/contracts";

// ─── Zustand Store ───────────────────────────────────────────────

interface ContractConfigState {
	deployments: ContractDeploymentConfig[];
	isLoaded: boolean;
	isLoading: boolean;
	error: string | null;
	lastFetchedAt: number | null;
	fetch: () => Promise<void>;
}

export const useContractConfigStore = create<ContractConfigState>(
	(set, get) => ({
		deployments: [],
		isLoaded: false,
		isLoading: false,
		error: null,
		lastFetchedAt: null,

		fetch: async () => {
			// Skip if already loading
			if (get().isLoading) return;

			// Skip if loaded recently (within 60 seconds)
			const lastFetched = get().lastFetchedAt;
			if (lastFetched && Date.now() - lastFetched < 60_000) return;

			set({ isLoading: true, error: null });
			try {
				const deployments = await getActiveContractDeployments();
				set({
					deployments,
					isLoaded: true,
					isLoading: false,
					lastFetchedAt: Date.now(),
				});
			} catch (err) {
				console.error(
					"[ContractConfig] Failed to fetch deployments:",
					err,
				);
				set({
					isLoading: false,
					error:
						err instanceof Error
							? err.message
							: "Failed to fetch contract config",
				});
			}
		},
	}),
);

// ─── React Hook ──────────────────────────────────────────────────

export function useContractConfig() {
	const { deployments, isLoaded, isLoading, error, fetch } =
		useContractConfigStore();

	// Auto-fetch on first use
	useEffect(() => {
		if (!isLoaded && !isLoading) {
			fetch();
		}
	}, [isLoaded, isLoading, fetch]);

	/**
	 * Get the active deployment for a specific chain ID
	 */
	const getDeploymentByChainId = useCallback(
		(chainId: number): ContractDeploymentConfig | undefined => {
			return deployments.find(
				(d) => d.chainId === chainId && d.isActive,
			);
		},
		[deployments],
	);

	/**
	 * Get factory address for a chain
	 */
	const getFactoryAddress = useCallback(
		(chainId: number): `0x${string}` | null => {
			const deployment = getDeploymentByChainId(chainId);
			return deployment
				? (deployment.factoryAddress as `0x${string}`)
				: null;
		},
		[getDeploymentByChainId],
	);

	/**
	 * Get creation fee for a chain (in smallest unit as bigint)
	 */
	const getCreationFee = useCallback(
		(chainId: number): bigint | null => {
			const deployment = getDeploymentByChainId(chainId);
			if (!deployment?.creationFee) return null;
			try {
				return BigInt(deployment.creationFee);
			} catch {
				return null;
			}
		},
		[getDeploymentByChainId],
	);

	/**
	 * Get the active deployment for the currently connected chain type
	 */
	const getDeploymentByChainType = useCallback(
		(chainType: "EVM" | "SOLANA"): ContractDeploymentConfig | undefined => {
			return deployments.find(
				(d) => d.chainType === chainType && d.isActive,
			);
		},
		[deployments],
	);

	/**
	 * All active EVM deployments
	 */
	const evmDeployments = useMemo(
		() => deployments.filter((d) => d.chainType === "EVM"),
		[deployments],
	);

	/**
	 * All active Solana deployments
	 */
	const solanaDeployments = useMemo(
		() => deployments.filter((d) => d.chainType === "SOLANA"),
		[deployments],
	);

	return {
		deployments,
		evmDeployments,
		solanaDeployments,
		isLoaded,
		isLoading,
		error,
		refetch: fetch,
		getDeploymentByChainId,
		getDeploymentByChainType,
		getFactoryAddress,
		getCreationFee,
	};
}
