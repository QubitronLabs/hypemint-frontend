"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAlerts,
  createAlert,
  deleteAlert,
  type PriceAlert,
  type CreateAlertInput,
  type AlertStatus,
} from "@/lib/api/alerts";

// Query keys
export const alertKeys = {
  all: ["alerts"] as const,
  lists: () => [...alertKeys.all, "list"] as const,
  list: (status?: AlertStatus) => [...alertKeys.lists(), status] as const,
};

/**
 * Hook to fetch user's alerts
 */
export function useAlerts(status?: AlertStatus) {
  return useQuery({
    queryKey: alertKeys.list(status),
    queryFn: () => getAlerts(status),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to create an alert
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAlertInput) => createAlert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}

/**
 * Hook to delete an alert
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}
