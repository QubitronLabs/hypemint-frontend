'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
    id: string;
    walletAddress: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    isVerified?: boolean;
    followersCount?: number;
    followingCount?: number;
    tokensCreated?: number;
    tradesCount?: number;
}

export interface DynamicUser {
    dynamicUserId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
}

interface AuthState {
    // JWT token from Dynamic.xyz
    jwt: string | null;
    // User data from our backend
    user: AuthUser | null;
    // Dynamic.xyz user info
    dynamicUser: DynamicUser | null;
    // Loading state
    isLoading: boolean;
    // Is authenticated (has JWT)
    isAuthenticated: boolean;
    // Has the user been fetched from backend?
    isUserFetched: boolean;
    // Last fetch timestamp (to prevent multiple calls)
    lastFetchTime: number;
    // Has hydration from localStorage completed?
    _hasHydrated: boolean;

    // Actions
    setJwt: (jwt: string | null) => void;
    setUser: (user: AuthUser | null) => void;
    updateUser: (updates: Partial<AuthUser>) => void;
    setDynamicUser: (dynamicUser: DynamicUser | null) => void;
    setLoading: (loading: boolean) => void;
    setUserFetched: (fetched: boolean) => void;
    logout: () => void;
    reset: () => void;
    setHasHydrated: (state: boolean) => void;
}

const FETCH_COOLDOWN_MS = 5000; // 5 second cooldown between fetches

/**
 * Auth Store - Manages JWT token and user state
 * 
 * JWT is obtained from Dynamic.xyz after wallet connection.
 * It's stored in localStorage and used in all API requests via the
 * Authorization: Bearer <token> header.
 * 
 * IMPORTANT: User state is cached and only fetched once per session
 * to avoid multiple redundant API calls.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            jwt: null,
            user: null,
            dynamicUser: null,
            isLoading: false,
            isAuthenticated: false,
            isUserFetched: false,
            lastFetchTime: 0,
            _hasHydrated: false,

            setJwt: (jwt) =>
                set({
                    jwt,
                    isAuthenticated: !!jwt,
                    // Reset user fetched state when JWT changes
                    isUserFetched: false,
                }),

            setUser: (user) =>
                set({
                    user,
                    isUserFetched: true,
                    lastFetchTime: Date.now(),
                }),

            // Partial update of user (e.g., after setting username)
            updateUser: (updates) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...updates } : null,
                })),

            setDynamicUser: (dynamicUser) => set({ dynamicUser }),

            setLoading: (isLoading) => set({ isLoading }),

            setUserFetched: (isUserFetched) => set({ isUserFetched }),

            logout: () =>
                set({
                    jwt: null,
                    user: null,
                    dynamicUser: null,
                    isAuthenticated: false,
                    isUserFetched: false,
                    lastFetchTime: 0,
                }),

            reset: () =>
                set({
                    jwt: null,
                    user: null,
                    dynamicUser: null,
                    isLoading: false,
                    isAuthenticated: false,
                    isUserFetched: false,
                    lastFetchTime: 0,
                }),

            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'hypemint-auth',
            storage: createJSONStorage(() => localStorage),
            // Persist JWT and user data
            partialize: (state) => ({
                jwt: state.jwt,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
            // Called after hydration is complete
            onRehydrateStorage: () => (state) => {
                console.log('[Auth] Hydration complete, jwt:', state?.jwt ? 'present' : 'none');
                state?.setHasHydrated(true);
            },
        }
    )
);

// Selector hooks for convenience
export const useJwt = () => useAuthStore((state) => state.jwt);
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsUserFetched = () => useAuthStore((state) => state.isUserFetched);
export const useHasHydrated = () => useAuthStore((state) => state._hasHydrated);

/**
 * Check if we should fetch user (cooldown check)
 */
export function shouldFetchUser(): boolean {
    const state = useAuthStore.getState();
    if (!state.jwt) return false;
    if (state.isUserFetched) return false;
    if (Date.now() - state.lastFetchTime < FETCH_COOLDOWN_MS) return false;
    return true;
}
