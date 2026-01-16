'use client';

import { DynamicContextProvider, useDynamicContext, useIsLoggedIn, getAuthToken } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';
import { type ReactNode, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth';
import { getCurrentUser } from '@/lib/api/auth';

interface DynamicProviderProps {
    children: ReactNode;
}

/**
 * Inner component that handles JWT extraction and auth sync
 * Must be inside DynamicContextProvider to access hooks
 */
function AuthSync({ children }: { children: ReactNode }) {
    const { user, primaryWallet, handleLogOut } = useDynamicContext();
    const isLoggedIn = useIsLoggedIn();
    const { setJwt, setUser, setDynamicUser, setLoading, logout } = useAuthStore();

    // Handle auth token changes from Dynamic.xyz
    const syncAuth = useCallback(async () => {
        if (isLoggedIn && primaryWallet) {
            console.log('[Auth] Dynamic.xyz connected - fetching JWT');
            setLoading(true);

            try {
                // Get JWT token using getAuthToken utility
                const authToken = await getAuthToken();

                if (authToken) {
                    console.log('[Auth] Dynamic.xyz JWT obtained');
                    // Store the JWT in our auth store
                    setJwt(authToken);
                }

                // Store Dynamic.xyz user info
                if (user) {
                    setDynamicUser({
                        dynamicUserId: user.userId || '',
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    });
                }

                // Fetch user from our backend using the JWT
                if (authToken) {
                    try {
                        const backendUser = await getCurrentUser();
                        setUser(backendUser);
                        console.log('[Auth] Backend user fetched:', backendUser);
                    } catch (err) {
                        console.warn('[Auth] Backend user fetch failed (user may not exist yet):', err);
                        // User might not exist in backend yet - that's OK
                    }
                }
            } catch (error) {
                console.error('[Auth] Auth sync failed:', error);
            } finally {
                setLoading(false);
            }
        } else if (!isLoggedIn) {
            // User logged out
            logout();
        }
    }, [isLoggedIn, primaryWallet, user, setJwt, setUser, setDynamicUser, setLoading, logout]);

    useEffect(() => {
        syncAuth();
    }, [syncAuth]);

    return <>{children}</>;
}

/**
 * Dynamic.xyz Wallet Provider with JWT Auth
 * 
 * Features:
 * - Supports Solana (default) + EVM chains
 * - Extracts JWT token after wallet sign-in using getAuthToken()
 * - Syncs auth state with backend
 * - Stores JWT in Zustand store for API requests
 */
export function DynamicProvider({ children }: DynamicProviderProps) {
    const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

    if (!environmentId) {
        console.warn(
            '[Dynamic] NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID not set. Wallet connection will not work.'
        );
    }

    return (
        <DynamicContextProvider
            settings={{
                environmentId: environmentId || 'demo-environment-id',
                walletConnectors: [
                    // Solana as primary chain (like pump.fun)
                    SolanaWalletConnectors,
                    // EVM chains ready for multi-chain expansion
                    EthereumWalletConnectors,
                ],
                // Dark theme to match our design
                cssOverrides: `
          .dynamic-widget-inline-controls {
            background: #111 !important;
            border-color: #222 !important;
          }
          .dynamic-widget-modal {
            background: #0a0a0a !important;
          }
          .dynamic-widget-card {
            background: #111 !important;
          }
        `,
            }}
        >
            <AuthSync>{children}</AuthSync>
        </DynamicContextProvider>
    );
}
