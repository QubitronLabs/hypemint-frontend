'use client';

import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import {
    useAuthStore,
    useJwt,
    useUser,
    useIsAuthenticated,
    useIsUserFetched,
} from '@/lib/auth';

/**
 * Hook to get auth state and user info
 *
 * Combines:
 * - Dynamic.xyz wallet connection state
 * - JWT token from auth store
 * - User data from backend (cached in store)
 *
 * NO API CALLS - uses cached data from auth store
 */
export function useAuth() {
    const { user: dynamicUser, primaryWallet, handleLogOut } = useDynamicContext();
    const isLoggedIn = useIsLoggedIn();

    const jwt = useJwt();
    const user = useUser();
    const isAuthenticated = useIsAuthenticated();
    const isUserFetched = useIsUserFetched();
    const { isLoading } = useAuthStore();
    

    return {
        // Auth state
        isAuthenticated,
        isLoading,
        isUserFetched,
        jwt,

        // User data (from cache)
        user,
        hasUsername: !!user?.username,

        // Dynamic.xyz data
        dynamicUser,
        primaryWallet,
        walletAddress: primaryWallet?.address as `0x${string}`,
        isLoggedIn,

        // Actions
        logout: handleLogOut,
    };
}

/**
 * Hook to get current user from cache
 * 
 * DOES NOT make API calls - uses cached data from auth store.
 * The user is fetched once during DynamicProvider auth sync.
 */
export function useCurrentUser() {
    const user = useUser();
    const isUserFetched = useIsUserFetched();
    const { isLoading } = useAuthStore();

    return {
        data: user,
        isLoading: isLoading && !isUserFetched,
        isFetched: isUserFetched,
        hasUsername: !!user?.username,
    };
}
