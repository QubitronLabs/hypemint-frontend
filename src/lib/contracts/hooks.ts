/**
 * HypeMint Contract Hooks
 *
 * React hooks for interacting with HypeMint smart contracts
 */

import { useCallback, useMemo } from "react";
import { parseEther, formatEther, type Address } from "viem";
import { HYPE_FACTORY_ABI, HYPE_BONDING_CURVE_ABI, HYPE_TOKEN_ABI } from "./abis";
import { getContractAddress, DEFAULT_CREATION_FEE, DEFAULT_SLIPPAGE_BPS } from "./config";

// Types
export interface CreateTokenParams {
  name: string;
  symbol: string;
  imageURI: string;
  description: string;
  hypeBoostEnabled: boolean;
}

export interface BuyTokenParams {
  bondingCurveAddress: Address;
  maticAmount: bigint;
  minTokens?: bigint;
  slippageBps?: number;
}

export interface SellTokenParams {
  bondingCurveAddress: Address;
  tokenAddress: Address;
  tokenAmount: bigint;
  minMatic?: bigint;
  slippageBps?: number;
}

export interface TokenInfo {
  tokenAddress: Address;
  bondingCurveAddress: Address;
  creator: Address;
  name: string;
  symbol: string;
  imageURI: string;
  description: string;
  hypeBoostEnabled: boolean;
  createdAt: bigint;
  isBlacklisted: boolean;
}

export interface BondingCurveState {
  currentPrice: bigint;
  marketCap: bigint;
  totalSupply: bigint;
  reserveBalance: bigint;
  isGraduated: boolean;
}

export interface HypeBoostConfig {
  enabled: boolean;
  maxWalletPercent: bigint;
  snipeProtectionBlocks: bigint;
  maxBuyPerBlock: bigint;
  vestingDuration: bigint;
  immediateUnlockPercent: bigint;
}

// Hook to get factory contract config
export function useFactoryConfig() {
  const factoryAddress = getContractAddress("factory");

  return {
    address: factoryAddress,
    abi: HYPE_FACTORY_ABI,
  };
}

// Hook to get bonding curve contract config
export function useBondingCurveConfig(bondingCurveAddress: Address) {
  return {
    address: bondingCurveAddress,
    abi: HYPE_BONDING_CURVE_ABI,
  };
}

// Hook to get token contract config
export function useTokenConfig(tokenAddress: Address) {
  return {
    address: tokenAddress,
    abi: HYPE_TOKEN_ABI,
  };
}

// Calculate minimum tokens with slippage
export function calculateMinTokens(
  expectedTokens: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): bigint {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (expectedTokens * slippageMultiplier) / BigInt(10000);
}

// Calculate minimum MATIC with slippage
export function calculateMinMatic(
  expectedMatic: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): bigint {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (expectedMatic * slippageMultiplier) / BigInt(10000);
}

// Format price for display
export function formatPrice(priceWei: bigint): string {
  const price = Number(formatEther(priceWei));
  if (price < 0.000001) {
    return price.toExponential(4);
  }
  if (price < 0.01) {
    return price.toFixed(8);
  }
  if (price < 1) {
    return price.toFixed(6);
  }
  return price.toFixed(4);
}

// Format market cap for display
export function formatMarketCap(marketCapWei: bigint): string {
  const marketCap = Number(formatEther(marketCapWei));
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toFixed(2)}K`;
  }
  return `$${marketCap.toFixed(2)}`;
}

// Format token amount for display
export function formatTokenAmount(amountWei: bigint, decimals: number = 18): string {
  const amount = Number(formatEther(amountWei));
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(4);
}

// Parse token amount from user input
export function parseTokenAmount(amount: string): bigint {
  try {
    return parseEther(amount);
  } catch {
    return BigInt(0);
  }
}

// Calculate bonding curve progress (0-100)
export function calculateCurveProgress(
  currentSupply: bigint,
  graduationSupply: bigint
): number {
  if (graduationSupply === BigInt(0)) return 0;
  const progress = Number((currentSupply * BigInt(100)) / graduationSupply);
  return Math.min(progress, 100);
}

// Get graduation status text
export function getGraduationStatus(
  isGraduated: boolean,
  marketCap: bigint,
  thresholdUsd: number = 69000
): string {
  if (isGraduated) {
    return "Graduated to QuickSwap 🎉";
  }
  const marketCapUsd = Number(formatEther(marketCap));
  const remaining = thresholdUsd - marketCapUsd;
  if (remaining <= 0) {
    return "Graduating soon...";
  }
  return `$${remaining.toFixed(0)} to graduation`;
}

// Export contract ABIs for direct use
export { HYPE_FACTORY_ABI, HYPE_BONDING_CURVE_ABI, HYPE_TOKEN_ABI };
export { getContractAddress, DEFAULT_CREATION_FEE, DEFAULT_SLIPPAGE_BPS };
