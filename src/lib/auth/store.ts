'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
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

interface DynamicUser {
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
    // Is authenticated
    isAuthenticated: boolean;

    // Actions
    setJwt: (jwt: string | null) => void;
    setUser: (user: AuthUser | null) => void;
    setDynamicUser: (dynamicUser: DynamicUser | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

/**
 * Auth Store - Manages JWT token and user state
 * 
 * JWT is obtained from Dynamic.xyz after wallet connection.
 * It's stored in localStorage and used in all API requests via the
 * Authorization: Bearer <token> header.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            jwt: null,
            user: null,
            dynamicUser: null,
            isLoading: false,
            isAuthenticated: false,

            setJwt: (jwt) => set({ jwt, isAuthenticated: !!jwt }),

            setUser: (user) => set({ user }),

            setDynamicUser: (dynamicUser) => set({ dynamicUser }),

            setLoading: (isLoading) => set({ isLoading }),

            logout: () => set({
                jwt: null,
                user: null,
                dynamicUser: null,
                isAuthenticated: false
            }),
        }),
        {
            name: 'hypemint-auth',
            // Only persist JWT in localStorage
            partialize: (state) => ({ jwt: state.jwt }),
        }
    )
);

// Selector hooks for convenience
export const useJwt = () => useAuthStore((state) => state.jwt);
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
