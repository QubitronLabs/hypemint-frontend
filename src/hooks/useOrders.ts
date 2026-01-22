"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrders,
  createOrder,
  getOrderBook,
  cancelOrder,
  type LimitOrder,
  type CreateOrderInput,
  type OrderStatus,
  type OrderBook,
} from "@/lib/api/orders";

// Query keys
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (status?: OrderStatus) => [...orderKeys.lists(), status] as const,
  books: () => [...orderKeys.all, "book"] as const,
  book: (tokenId: string) => [...orderKeys.books(), tokenId] as const,
};

/**
 * Hook to fetch user's orders
 */
export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: orderKeys.list(status),
    queryFn: () => getOrders(status),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to fetch order book
 */
export function useOrderBook(tokenId: string, depth?: number) {
  return useQuery({
    queryKey: orderKeys.book(tokenId),
    queryFn: () => getOrderBook(tokenId, depth),
    enabled: !!tokenId,
    staleTime: 5 * 1000, // More frequent for order book
    refetchInterval: 10 * 1000, // Auto-refetch every 10s
  });
}

/**
 * Hook to create an order
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({
        queryKey: orderKeys.book(order.tokenId),
      });
    },
  });
}

/**
 * Hook to cancel an order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
