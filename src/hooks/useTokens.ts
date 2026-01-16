'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTokens, getTrendingTokens, getNewTokens, getToken, createToken } from '@/lib/api/tokens';
import type { TokenListParams, CreateTokenInput } from '@/types';

// Query keys for cache management
export const tokenKeys = {
    all: ['tokens'] as const,
    lists: () => [...tokenKeys.all, 'list'] as const,
    list: (params: TokenListParams) => [...tokenKeys.lists(), params] as const,
    trending: (params?: Omit<TokenListParams, 'orderBy'>) => [...tokenKeys.all, 'trending', params] as const,
    new: (params?: Omit<TokenListParams, 'orderBy'>) => [...tokenKeys.all, 'new', params] as const,
    details: () => [...tokenKeys.all, 'detail'] as const,
    detail: (id: string) => [...tokenKeys.details(), id] as const,
};

// Hook to fetch paginated token list
export function useTokens(params?: TokenListParams) {
    return useQuery({
        queryKey: tokenKeys.list(params ?? {}),
        queryFn: () => getTokens(params),
        staleTime: 30 * 1000, // 30 seconds
    });
}

// Hook to fetch trending tokens (by 24h volume)
export function useTrendingTokens(params?: Omit<TokenListParams, 'orderBy'>) {
    return useQuery({
        queryKey: tokenKeys.trending(params),
        queryFn: () => getTrendingTokens(params),
        staleTime: 30 * 1000,
    });
}

// Hook to fetch new tokens (recently created)
export function useNewTokens(params?: Omit<TokenListParams, 'orderBy'>) {
    return useQuery({
        queryKey: tokenKeys.new(params),
        queryFn: () => getNewTokens(params),
        staleTime: 30 * 1000,
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
        },
    });
}
