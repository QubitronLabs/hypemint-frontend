/**
 * Universal Trade Hook (Chain-Agnostic Facade)
 *
 * Provides a unified API for buying and selling tokens across
 * different blockchains (EVM and Solana).
 *
 * Internally switches between:
 * - useContracts.ts (Wagmi/Viem) for EVM chains
 * - useSolanaContracts.ts for Solana
 *
 * Usage:
 *   const { buy, sell, isProcessing } = useUniversalTrade({
 *     chainType: token.chainType,
 *     tokenAddress: token.contractAddress,
 *   });
 */

"use client";

import { useCallback, useMemo } from "react";
import { useBuyTokens, useSellTokens } from "./useContracts";
import { useSolanaBuyTokens, useSolanaSellTokens } from "./useSolanaContracts";
import type { Address } from "viem";

export type ChainType = "EVM" | "SOLANA";

export interface UniversalTradeParams {
	chainType: ChainType;
	tokenAddress?: string;
}

export interface UniversalBuyParams {
	bondingCurveAddress: string;
	amount: string; // Native currency amount (ETH/SOL, not denomination)
	slippageBps?: number;
}

export interface UniversalSellParams {
	bondingCurveAddress: string;
	tokenAddress: string;
	tokenAmount: string;
	minReceived?: string;
	slippageBps?: number;
}

export interface UniversalTradeReturn {
	/** Execute a buy order */
	buy: (params: UniversalBuyParams) => Promise<string | null>;
	/** Execute a sell order */
	sell: (params: UniversalSellParams) => Promise<string | null>;
	/** Whether a buy is currently in progress */
	isBuying: boolean;
	/** Whether a sell is currently in progress */
	isSelling: boolean;
	/** Whether any transaction is confirming on-chain */
	isConfirming: boolean;
	/** Whether the last transaction was confirmed */
	isConfirmed: boolean;
	/** Whether the last transaction failed */
	isFailed: boolean;
	/** The last transaction hash/signature */
	txHash: string | undefined;
	/** Any error from the last operation */
	error: Error | null;
	/** Reset state for new trade */
	reset: () => void;
	/** Which chain type is active */
	activeChainType: ChainType;
}

/**
 * useUniversalTrade
 *
 * A facade hook that delegates to the appropriate chain-specific
 * trading hook based on the token's chainType.
 */
export function useUniversalTrade({
	chainType,
}: UniversalTradeParams): UniversalTradeReturn {
	// === EVM Trading Hooks ===
	const evmBuy = useBuyTokens();
	const evmSell = useSellTokens();

	// === Solana Trading Hooks ===
	const solanaBuy = useSolanaBuyTokens();
	const solanaSell = useSolanaSellTokens();

	// === Unified Buy ===
	const buy = useCallback(
		async (params: UniversalBuyParams): Promise<string | null> => {
			if (chainType === "EVM") {
				return evmBuy.buy({
					bondingCurveAddress: params.bondingCurveAddress as Address,
					maticAmount: params.amount,
					slippageBps: params.slippageBps,
				});
			}

			if (chainType === "SOLANA") {
				return solanaBuy.buy({
					bondingCurveAddress: params.bondingCurveAddress,
					solAmount: params.amount,
					slippageBps: params.slippageBps,
				});
			}

			return null;
		},
		[chainType, evmBuy, solanaBuy]
	);

	// === Unified Sell ===
	const sell = useCallback(
		async (params: UniversalSellParams): Promise<string | null> => {
			if (chainType === "EVM") {
				return evmSell.sell({
					bondingCurveAddress: params.bondingCurveAddress as Address,
					tokenAddress: params.tokenAddress as Address,
					tokenAmount: params.tokenAmount,
					minMatic: params.minReceived,
					slippageBps: params.slippageBps,
				});
			}

			if (chainType === "SOLANA") {
				return solanaSell.sell({
					bondingCurveAddress: params.bondingCurveAddress,
					tokenAddress: params.tokenAddress,
					tokenAmount: params.tokenAmount,
					minSol: params.minReceived,
					slippageBps: params.slippageBps,
				});
			}

			return null;
		},
		[chainType, evmSell, solanaSell]
	);

	// === Aggregate State ===
	const state = useMemo(() => {
		if (chainType === "SOLANA") {
			return {
				isBuying: solanaBuy.isBuying,
				isSelling: solanaSell.isSelling,
				isConfirming: solanaBuy.isConfirming || solanaSell.isConfirming,
				isConfirmed: solanaBuy.isConfirmed || solanaSell.isConfirmed,
				isFailed: solanaBuy.isFailed || solanaSell.isFailed,
				txHash: solanaBuy.txSignature || solanaSell.txSignature,
				error: solanaBuy.error || solanaSell.error,
			};
		}

		// Default: EVM
		return {
			isBuying: evmBuy.isBuying,
			isSelling: evmSell.isSelling,
			isConfirming: evmBuy.isConfirming || evmSell.isConfirming,
			isConfirmed: evmBuy.isConfirmed || evmSell.isConfirmed,
			isFailed: evmBuy.isFailed || evmSell.isFailed,
			txHash: evmBuy.txHash || evmSell.txHash,
			error: evmBuy.error || evmSell.error,
		};
	}, [chainType, evmBuy, evmSell, solanaBuy, solanaSell]);

	// === Reset ===
	const reset = useCallback(() => {
		evmBuy.reset();
		evmSell.reset();
		solanaBuy.reset();
		solanaSell.reset();
	}, [evmBuy, evmSell, solanaBuy, solanaSell]);

	return {
		buy,
		sell,
		...state,
		reset,
		activeChainType: chainType,
	};
}
