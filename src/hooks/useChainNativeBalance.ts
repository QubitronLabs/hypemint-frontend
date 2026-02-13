/**
 * Chain-Aware Native Balance Hook
 *
 * Automatically fetches the native token balance from the correct chain
 * based on the user's active chain type (EVM or Solana).
 *
 * - EVM: Uses Wagmi's useBalance (ETH/POL/etc.)
 * - Solana: Uses Dynamic's SolanaWalletConnector.getBalance() (SOL)
 *
 * Returns a normalized shape:
 *   { value: bigint, decimals: number, symbol: string, formatted: string }
 */

"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useActiveChainType } from "@/lib/network";
import { useNativeBalance } from "./useContracts";
import { useSolanaNativeBalance } from "./useSolanaContracts";

export interface ChainBalance {
	/** Raw balance in smallest unit (wei / lamports) */
	value: bigint;
	/** Number of decimal places (18 for EVM, 9 for SOL) */
	decimals: number;
	/** Currency symbol (ETH, POL, SOL, etc.) */
	symbol: string;
	/** Human-readable formatted string */
	formatted: string;
}

export function useChainNativeBalance(): {
	data: ChainBalance | undefined;
	isLoading: boolean;
} {
	const activeChainType = useActiveChainType();

	// Always call both hooks (React rules of hooks)
	const evmBalance = useNativeBalance();
	const solBalance = useSolanaNativeBalance();

	const result = useMemo(() => {
		if (activeChainType === "SOLANA") {
			return {
				data: solBalance.data
					? {
							value: solBalance.data.value,
							decimals: solBalance.data.decimals,
							symbol: solBalance.data.symbol,
							formatted: solBalance.data.formatted,
						}
					: undefined,
				isLoading: solBalance.isLoading,
			};
		}

		// EVM
		return {
			data: evmBalance.data
				? {
						value: evmBalance.data.value,
						decimals: evmBalance.data.decimals,
						symbol: evmBalance.data.symbol,
						formatted: formatUnits(evmBalance.data.value, evmBalance.data.decimals),
					}
				: undefined,
			isLoading: evmBalance.isLoading,
		};
	}, [activeChainType, evmBalance.data, evmBalance.isLoading, solBalance.data, solBalance.isLoading]);

	return result;
}
