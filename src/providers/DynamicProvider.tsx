"use client";

import {
  DynamicContextProvider,
  useDynamicContext,
  useIsLoggedIn,
  getAuthToken,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { type ReactNode, useEffect, useRef, useCallback } from "react";
import { useAuthStore, shouldFetchUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/api/auth";
import { forceLogout } from "@/lib/api/client";

interface DynamicProviderProps {
  children: ReactNode;
}

/**
 * Inner component that handles JWT extraction and auth sync
 * Must be inside DynamicContextProvider to access hooks
 */
function AuthSync({ children }: { children: ReactNode }) {
  const { user, primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const {
    setJwt,
    setUser,
    setDynamicUser,
    setLoading,
    setUserFetched,
    logout,
    isUserFetched,
  } = useAuthStore();

  // Track if we're currently syncing to prevent duplicate calls
  const isSyncingRef = useRef(false);
  const lastWalletRef = useRef<string | null>(null);

  // Handle auth token changes from Dynamic.xyz
  const syncAuth = useCallback(async () => {
    // Prevent concurrent sync calls
    if (isSyncingRef.current) return;

    const currentWallet = primaryWallet?.address || null;

    // If wallet hasn't changed and user is already fetched, skip
    if (currentWallet === lastWalletRef.current && isUserFetched) {
      return;
    }

    if (isLoggedIn && primaryWallet) {
      // Check if we should fetch (respects cooldown)
      if (!shouldFetchUser() && isUserFetched) {
        return;
      }

      isSyncingRef.current = true;
      setLoading(true);

      try {
        // Get JWT token using getAuthToken utility
        const authToken = await getAuthToken();

        if (authToken) {
          console.log("[Auth] JWT obtained successfully");
          setJwt(authToken);
        }

        // Store Dynamic.xyz user info
        if (user) {
          setDynamicUser({
            dynamicUserId: user.userId || "",
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
            lastWalletRef.current = currentWallet;
            console.log(
              "[Auth] User fetched:",
              backendUser.username || "(no username)",
            );
          } catch (err: any) {
            // Check if this is a 401 error (token expired)
            if (err?.response?.status === 401) {
              console.warn("[Auth] Token expired during sync - forcing logout");
              await forceLogout();
              return;
            }
            // User might not exist in backend yet - that's OK
            // Set as fetched to prevent retry loop
            setUserFetched(true);
            lastWalletRef.current = currentWallet;
            console.log("[Auth] No backend user yet (new user)");
          }
        }
      } catch (error) {
        console.error("[Auth] Auth sync failed:", error);
      } finally {
        setLoading(false);
        isSyncingRef.current = false;
      }
    } else if (!isLoggedIn && lastWalletRef.current !== null) {
      // User logged out
      lastWalletRef.current = null;
      logout();
    }
  }, [
    isLoggedIn,
    primaryWallet,
    user,
    isUserFetched,
    setJwt,
    setUser,
    setDynamicUser,
    setLoading,
    setUserFetched,
    logout,
  ]);

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
 * - Syncs auth state with backend (ONCE per session)
 * - Stores JWT in Zustand store for API requests
 * - Prevents multiple redundant API calls
 */
export function DynamicProvider({ children }: DynamicProviderProps) {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

  if (!environmentId) {
    console.warn(
      "[Dynamic] NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID not set. Wallet connection will not work.",
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId: environmentId || "demo-environment-id",
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
