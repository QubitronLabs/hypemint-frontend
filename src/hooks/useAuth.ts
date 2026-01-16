'use client';

import { useQuery } from '@tanstack/react-query';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAuthStore, useJwt, useUser, useIsAuthenticated } from '@/lib/auth';
import { getAuthMe } from '@/lib/api/auth';

/**
 * Hook to get auth state and user info
 * 
 * Combines:
 * - Dynamic.xyz wallet connection state
 * - JWT token from auth store
 * - User data from backend
 */
export function useAuth() {
    const { user: dynamicUser, primaryWallet, handleLogOut } = useDynamicContext();
    const isLoggedIn = useIsLoggedIn();

    const jwt = useJwt();
    const user = useUser();
    const isAuthenticated = useIsAuthenticated();
    const { isLoading } = useAuthStore();

    return {
        // Auth state
        isAuthenticated,
        isLoading,
        jwt,

        // User data
        user,

        // Dynamic.xyz data
        dynamicUser,
        primaryWallet,
        walletAddress: primaryWallet?.address,

        // Actions
        logout: handleLogOut,
    };
}

/**
 * Hook to fetch and cache current user from backend
 * Uses JWT in Authorization header
 * Returns just the User object for easier consumption
 */
export function useCurrentUser() {
    const jwt = useJwt();

    return useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const response = await getAuthMe();
            return response.user; // Return just the user object
        },
        enabled: !!jwt, // Only run when we have a JWT
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: false, // Don't retry on 401
    });
}
