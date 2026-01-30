/**
 * User Hooks with Optimistic Updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getUserProfileByAddress,
	getUserCreatedTokens,
	type UserProfileResponse,
} from "@/lib/api/users";
import {
	followUser,
	unfollowUser,
	getUserFollowers,
	getUserFollowing,
} from "@/lib/api/auth";
import { useAuthStore, useHasHydrated } from "@/lib/auth";

/**
 * Fetch a user's public profile by wallet address
 * IMPORTANT: Waits for auth hydration before fetching to ensure JWT is available
 */
export function useUserProfile(address: string | undefined) {
	// Check if Zustand has hydrated from localStorage
	const hasHydrated = useHasHydrated();
	// Use JWT presence to determine if authenticated
	const hasAuth = useAuthStore((state) => !!state.jwt);

	return useQuery<UserProfileResponse>({
		// Include auth status in query key so it refetches when user logs in/out
		queryKey: ["user", address, "hasAuth", hasAuth],
		queryFn: async () => {
			console.log(
				"[useUserProfile] Fetching profile for",
				address,
				"hasAuth:",
				hasAuth,
			);
			return getUserProfileByAddress(address!);
		},
		// CRITICAL: Only enable query after hydration is complete
		// This ensures JWT from localStorage is available before we fetch
		enabled: !!address && hasHydrated,
		staleTime: 30000, // 30 seconds
		refetchOnWindowFocus: false,
	});
}

/**
 * Follow a user mutation with optimistic updates
 */
export function useFollowUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (address: string) => followUser(address),
		// Optimistic update - immediately update UI before server response
		onMutate: async (address: string) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey: ["user", address] });

			// Find the matching query data with hasAuth: true
			const queryKey = ["user", address, "hasAuth", true];
			const previousData =
				queryClient.getQueryData<UserProfileResponse>(queryKey);

			// Optimistically update the cache
			if (previousData) {
				queryClient.setQueryData<UserProfileResponse>(queryKey, {
					...previousData,
					isFollowing: true,
					user: {
						...previousData.user,
						followersCount: previousData.user.followersCount + 1,
					},
				});
			}

			// Return context with the previous data for rollback
			return { previousData, queryKey };
		},
		// If mutation fails, roll back to the previous value
		onError: (err, address, context) => {
			console.error("Follow failed:", err);
			if (context?.previousData && context?.queryKey) {
				queryClient.setQueryData(
					context.queryKey,
					context.previousData,
				);
			}
		},
		// On success, invalidate to refetch fresh data
		onSuccess: (_, address) => {
			queryClient.invalidateQueries({ queryKey: ["user", address] });
		},
	});
}

/**
 * Unfollow a user mutation with optimistic updates
 */
export function useUnfollowUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (address: string) => unfollowUser(address),
		// Optimistic update - immediately update UI before server response
		onMutate: async (address: string) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey: ["user", address] });

			// Find the matching query data with hasAuth: true
			const queryKey = ["user", address, "hasAuth", true];
			const previousData =
				queryClient.getQueryData<UserProfileResponse>(queryKey);

			// Optimistically update the cache
			if (previousData) {
				queryClient.setQueryData<UserProfileResponse>(queryKey, {
					...previousData,
					isFollowing: false,
					user: {
						...previousData.user,
						followersCount: Math.max(
							0,
							previousData.user.followersCount - 1,
						),
					},
				});
			}

			// Return context with the previous data for rollback
			return { previousData, queryKey };
		},
		// If mutation fails, roll back to the previous value
		onError: (err, address, context) => {
			console.error("Unfollow failed:", err);
			if (context?.previousData && context?.queryKey) {
				queryClient.setQueryData(
					context.queryKey,
					context.previousData,
				);
			}
		},
		// On success, invalidate to refetch fresh data
		onSuccess: (_, address) => {
			queryClient.invalidateQueries({ queryKey: ["user", address] });
		},
	});
}

/**
 * Get user's followers
 */
export function useUserFollowers(
	address: string | undefined,
	page = 1,
	pageSize = 20,
) {
	return useQuery({
		queryKey: ["user", address, "followers", page, pageSize],
		queryFn: () => getUserFollowers(address!, page, pageSize),
		enabled: !!address,
		staleTime: 30000,
	});
}

/**
 * Get users that this user follows
 */
export function useUserFollowing(
	address: string | undefined,
	page = 1,
	pageSize = 20,
) {
	return useQuery({
		queryKey: ["user", address, "following", page, pageSize],
		queryFn: () => getUserFollowing(address!, page, pageSize),
		enabled: !!address,
		staleTime: 30000,
	});
}

/**
 * Get tokens created by a user
 */
export function useUserCreatedTokens(
	userId: string | undefined,
	page = 1,
	pageSize = 20,
) {
	return useQuery({
		queryKey: ["user", userId, "tokens", page, pageSize],
		queryFn: () => getUserCreatedTokens(userId!, page, pageSize),
		enabled: !!userId,
		staleTime: 30000,
	});
}
