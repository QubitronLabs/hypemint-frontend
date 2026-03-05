"use client";

import {
  DynamicContextProvider,
  useDynamicContext,
  useIsLoggedIn,
  getAuthToken,
  overrideNetworkRpcUrl,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { type ReactNode, useEffect, useRef, useCallback } from "react";
import { useAuthStore, shouldFetchUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/api/auth";
import { forceLogout } from "@/lib/api/client";
import { NetworkStateSynchronizer } from "@/components/network";
import { useAutoGenerateAvatar } from "@/hooks/useAutoGenerateAvatar";

// Ganache Local Development Network for Dynamic.xyz
// const ganacheNetwork = {
//   blockExplorerUrls: [],
//   chainId: 1337,
//   chainName: "Ganache Local",
//   iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
//   name: "Ganache",
//   nativeCurrency: {
//     decimals: 18,
//     name: "Ether",
//     symbol: "ETH",
//     iconUrl: "https://app.dynamic.xyz/assets/networks/eth.svg",
//   },
//   networkId: 1337,
//   rpcUrls: [process.env.NEXT_PUBLIC_GANACHE_RPC_URL || "http://127.0.0.1:7545"],
//   vanityName: "Ganache Local",
// };

// Check if running in local mode
// const isLocalMode = process.env.NEXT_PUBLIC_CHAIN_MODE === "local";

// Override Dynamic.xyz default RPCs with reliable public RPCs (no API keys needed)
const evmRpcUrlOverrides: Record<string, string[]> = {
  "1": ["https://eth.merkle.io"],
  "137": ["https://polygon.drpc.org"],
  "80002": ["https://rpc-amoy.polygon.technology"],
  "42161": ["https://arb1.arbitrum.io/rpc"],
  "10": ["https://mainnet.optimism.io"],
  "56": ["https://bsc-dataseed.binance.org"],
  "43114": ["https://api.avax.network/ext/bc/C/rpc"],
  "59144": ["https://rpc.linea.build"],
  "97": ["https://data-seed-prebsc-1-s1.binance.org:8545"],
  "11155111": ["https://rpc.sepolia.org"],
};

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
    // Note: Removed sdkHasLoaded check - Dynamic handles its own initialization
    
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
             
          } catch (err: any) {
            // Check if this is a 401 error (token expired)
            if (err?.response?.status === 401) { 
              await forceLogout();
              return;
            }
            // User might not exist in backend yet - that's OK
            // Set as fetched to prevent retry loop
            setUserFetched(true);
            lastWalletRef.current = currentWallet; 
          }
        }
      } catch (error){ 
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

  // Auto-generate avatar for users who don't have one
  useAutoGenerateAvatar();

  return (
    <>
      {/* Global Network State Synchronizer - syncs wallet network to app state */}
      <NetworkStateSynchronizer />
      {children}
    </>
  );
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

        // Override default RPCs (Dynamic.xyz defaults use Alchemy keys that may be disabled)
        overrides: {
          evmNetworks: (networks) =>
            overrideNetworkRpcUrl(networks, evmRpcUrlOverrides),
        },
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
