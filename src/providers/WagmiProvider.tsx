'use client';

import { type ReactNode } from 'react';
import { WagmiProvider as WagmiProviderBase } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';

interface WagmiProviderProps {
  children: ReactNode;
}

/**
 * Wagmi Provider for Web3 interactions
 *
 * Provides Wagmi context for contract reads/writes throughout the app.
 * Works alongside Dynamic.xyz for wallet connection.
 */
export function WagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      {children}
    </WagmiProviderBase>
  );
}
