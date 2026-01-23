"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getTokens,
	getTrendingTokens,
	getNewTokens,
	getLiveTokens,
	getGraduatedTokens,
	getToken,
	createToken,
	getMyTokens,
	syncTokenWithBlockchain,
	getTokenHolders,
	getWalletTokenBalance,
} from "@/lib/api/tokens";
import type { TokenListParams, CreateTokenInput } from "@/types";

// Query keys for cache management
export const tokenKeys = {
	all: ["tokens"] as const,
	lists: () => [...tokenKeys.all, "list"] as const,
	list: (params: TokenListParams) => [...tokenKeys.lists(), params] as const,
	trending: (params?: Omit<TokenListParams, "orderBy">) =>
		[...tokenKeys.all, "trending", params] as const,
	new: (params?: Omit<TokenListParams, "orderBy">) =>
		[...tokenKeys.all, "new", params] as const,
	live: (params?: { chainId?: number; limit?: number }) =>
		[...tokenKeys.all, "live", params] as const,
	graduated: (params?: { chainId?: number; limit?: number }) =>
		[...tokenKeys.all, "graduated", params] as const,
	details: () => [...tokenKeys.all, "detail"] as const,
	detail: (id: string) => [...tokenKeys.details(), id] as const,
	myTokens: () => [...tokenKeys.all, "my-tokens"] as const,
	balance: (tokenId: string, walletAddress: string) =>
		[...tokenKeys.all, "balance", tokenId, walletAddress] as const,
	holders: (tokenId: string) =>
		[...tokenKeys.all, "holders", tokenId] as const,
};

// Options type for hooks with enabled flag
interface TokenHookOptions {
	enabled?: boolean;
}

// Hook to fetch paginated token list
export function useTokens(
	params?: TokenListParams,
	options?: TokenHookOptions,
) {
	return useQuery({
		queryKey: tokenKeys.list(params ?? {}),
		queryFn: () => getTokens(params),
		staleTime: 30 * 1000, // 30 seconds
		enabled: options?.enabled ?? true,
	});
}

// Hook to fetch trending tokens (by 24h volume)
export function useTrendingTokens(
	params?: Omit<TokenListParams, "orderBy">,
	options?: TokenHookOptions,
) {
	return useQuery({
		queryKey: tokenKeys.trending(params),
		queryFn: () => getTrendingTokens(params),
		staleTime: 30 * 1000,
		enabled: options?.enabled ?? true,
	});
}

// Hook to fetch new tokens (recently created)
export function useNewTokens(
	params?: Omit<TokenListParams, "orderBy">,
	options?: TokenHookOptions,
) {
	return useQuery({
		queryKey: tokenKeys.new(params),
		queryFn: () => getNewTokens(params),
		staleTime: 30 * 1000,
		enabled: options?.enabled ?? true,
	});
}

// Hook to fetch live tokens (actively trading)
export function useLiveTokens(
	params?: { chainId?: number; limit?: number },
	options?: TokenHookOptions,
) {
	return useQuery({
		queryKey: tokenKeys.live(params),
		queryFn: () => getLiveTokens(params),
		staleTime: 30 * 1000,
		enabled: options?.enabled ?? true,
	});
}

// Hook to fetch graduated tokens
export function useGraduatedTokens(
	params?: { chainId?: number; limit?: number },
	options?: TokenHookOptions,
) {
	return useQuery({
		queryKey: tokenKeys.graduated(params),
		queryFn: () => getGraduatedTokens(params),
		staleTime: 30 * 1000,
		enabled: options?.enabled ?? true,
	});
}

// Hook to fetch single token details
export function useToken(id: string) {
	return useQuery({
		queryKey: tokenKeys.detail(id),
		queryFn: () => getToken(id),
		enabled: !!id,
		staleTime: 10 * 1000, // 10 seconds - more frequent updates for detail page
	});
}

// Hook to create a new token
export function useCreateToken() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateTokenInput) => createToken(input),
		onSuccess: () => {
			// Invalidate all token lists to refresh
			queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
			queryClient.invalidateQueries({ queryKey: tokenKeys.trending() });
			queryClient.invalidateQueries({ queryKey: tokenKeys.new() });
			queryClient.invalidateQueries({ queryKey: tokenKeys.myTokens() });
		},
	});
}

// Hook to fetch user's created tokens
export function useMyTokens() {
	return useQuery({
		queryKey: tokenKeys.myTokens(),
		queryFn: () => getMyTokens(),
		staleTime: 30 * 1000, // 30 seconds
	});
}

// Hook to sync token with blockchain
export function useSyncToken() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (tokenId: string) => syncTokenWithBlockchain(tokenId),
		onSuccess: (data, tokenId) => {
			if (data.synced) {
				// Invalidate token detail to refresh with new data
				queryClient.invalidateQueries({
					queryKey: tokenKeys.detail(tokenId),
				});
			}
		},
	});
}

// Hook to fetch on-chain token balance for a wallet
export function useWalletTokenBalance(
	tokenId: string | undefined,
	walletAddress: string | undefined,
) {
	return useQuery({
		queryKey: tokenKeys.balance(tokenId || "", walletAddress || ""),
		queryFn: () => getWalletTokenBalance(tokenId!, walletAddress!),
		enabled: !!tokenId && !!walletAddress,
		staleTime: 30 * 1000, // 30 seconds
	});
}

// Hook to fetch token holders from blockchain
export function useTokenHolders(tokenId: string | undefined) {
	return useQuery({
		queryKey: tokenKeys.holders(tokenId || ""),
		queryFn: () => getTokenHolders(tokenId!),
		enabled: !!tokenId,
		staleTime: 60 * 1000, // 1 minute - holders don't change that frequently
		refetchOnWindowFocus: false,
	});
}
