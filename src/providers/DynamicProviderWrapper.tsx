"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useState, useEffect } from "react";

// Dynamically import the DynamicProvider to prevent SSR issues
// The @dynamic-labs/sdk-react-core package tries to access window/client during import
const DynamicProviderInternal = dynamic(
  () => import("./DynamicProvider").then((mod) => mod.DynamicProvider),
  {
    ssr: false,
  }
);

interface DynamicProviderWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper that ensures DynamicProvider is only loaded on the client side.
 * This prevents "Tried to getClient when it was still null" errors during SSR.
 * 
 * Uses a mounted state to ensure we only render after hydration is complete.
 * Children are NOT rendered during SSR to prevent Dynamic SDK hooks from being called.
 */
export function DynamicProviderWrapper({ children }: DynamicProviderWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, return null
  // This prevents any Dynamic SDK hooks from being called during SSR
  if (!mounted) {
    return null;
  }

  return <DynamicProviderInternal>{children}</DynamicProviderInternal>;
}
