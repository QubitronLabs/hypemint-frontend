'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTradeQuote, createTrade, confirmTrade, getTokenTrades, getUserTrades } from '@/lib/api/trades';
import { tokenKeys } from './useTokens';
import type { TradeType, CreateTradeInput, ConfirmTradeInput, Trade } from '@/types';

// Query keys
export const tradeKeys = {
    all: ['trades'] as const,
    quotes: () => [...tradeKeys.all, 'quote'] as const,
    quote: (tokenId: string, type: TradeType, amount: string) =>
        [...tradeKeys.quotes(), { tokenId, type, amount }] as const,
    byToken: (tokenId: string) => [...tradeKeys.all, 'token', tokenId] as const,
    user: () => [...tradeKeys.all, 'user'] as const,
};

// Hook to get trade quote (debounced in component)
export function useTradeQuote(
    tokenId: string,
    type: TradeType,
    amount: string,
    enabled = true
) {
    return useQuery({
        queryKey: tradeKeys.quote(tokenId, type, amount),
        queryFn: () => getTradeQuote(tokenId, type, amount),
        enabled: enabled && !!tokenId && !!amount && parseFloat(amount) > 0,
        staleTime: 5 * 1000, // 5 seconds - quotes are time-sensitive
        retry: false, // Don't retry failed quotes
    });
}

// Hook to get token trade history
export function useTokenTrades(tokenId: string) {
    return useQuery({
        queryKey: tradeKeys.byToken(tokenId),
        queryFn: () => getTokenTrades(tokenId),
        enabled: !!tokenId,
        staleTime: 10 * 1000,
    });
}

// Hook to create a trade (with optimistic updates)
export function useCreateTrade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateTradeInput) => createTrade(input),
        onMutate: async (newTrade) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: tradeKeys.byToken(newTrade.tokenId) });

            // Snapshot the previous value
            const previousTrades = queryClient.getQueryData<Trade[]>(tradeKeys.byToken(newTrade.tokenId));

            return { previousTrades };
        },
        onError: (_err, newTrade, context) => {
            // Rollback on error
            if (context?.previousTrades) {
                queryClient.setQueryData(tradeKeys.byToken(newTrade.tokenId), context.previousTrades);
            }
        },
        onSettled: (_data, _error, variables) => {
            // Always refetch after mutation settles
            queryClient.invalidateQueries({ queryKey: tradeKeys.byToken(variables.tokenId) });
            queryClient.invalidateQueries({ queryKey: tokenKeys.detail(variables.tokenId) });
        },
    });
}

// Hook to confirm a trade
export function useConfirmTrade() {
    const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			tradeId,
			input,
		}: {
			tradeId: string;
			input: ConfirmTradeInput;
		}) => confirmTrade(tradeId, input),
		onSuccess: (trade) => {
			// Invalidate related queries
			queryClient.invalidateQueries({
				queryKey: tradeKeys.byToken(trade.tokenId),
			});
			queryClient.invalidateQueries({
				queryKey: tokenKeys.detail(trade.tokenId),
			});
			queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
		},
	});
}

// Hook to get current user's trades
export function useUserTrades() {
    return useQuery({
        queryKey: tradeKeys.user(),
        queryFn: () => getUserTrades(),
        staleTime: 30 * 1000, // 30 seconds
    });
}
