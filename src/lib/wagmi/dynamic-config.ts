/**
 * Dynamic Wagmi Configuration
 *
 * Builds a Wagmi config from backend chain configurations fetched at runtime.
 * Uses POST /api/v1/rpc/:chainId as the primary transport (RPC proxy) so
 * that Alchemy API keys never leak to the browser.
 *
 * Falls back to public RPCs if the backend proxy is unreachable.
 */

import { http, fallback, createConfig, type Config, type Transport } from "wagmi";
import type { Chain } from "wagmi/chains";
import * as viemChains from "wagmi/chains";

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------
export interface BackendChainConfig {
  chainId: number;
  chainType: string;
  chainName: string;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals: number;
  explorerUrl: string | null;
  factoryAddress: string;
  creationFee: string | null;
  isTestnet: boolean;
  dexName: string | null;
}

// ---------------------------------------------------------------------------
//  Fetch chain configs from backend
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function fetchChainConfigs(): Promise<BackendChainConfig[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/config/chains`, {
      next: { revalidate: 300 }, // Cache for 5 min (Next.js)
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data ?? [];
  } catch {
    console.warn("[DynamicConfig] Failed to fetch chain configs, using fallback");
    return [];
  }
}

// ---------------------------------------------------------------------------
//  Resolve viem Chain object from chainId
// ---------------------------------------------------------------------------
const VIEM_CHAIN_MAP: Record<number, Chain> = {};
// Build lookup table from wagmi/chains
for (const val of Object.values(viemChains)) {
  if (val && typeof val === "object" && "id" in val) {
    VIEM_CHAIN_MAP[val.id as number] = val as Chain;
  }
}

export function getViemChainById(chainId: number): Chain | undefined {
  return VIEM_CHAIN_MAP[chainId];
}

// ---------------------------------------------------------------------------
//  Build transports (proxy → public fallback)
// ---------------------------------------------------------------------------
function buildTransport(chainId: number, publicRpcUrl?: string): Transport {
  const proxyUrl = `${API_URL}/api/v1/rpc/${chainId}`;

  if (publicRpcUrl) {
    return fallback([http(proxyUrl), http(publicRpcUrl)]);
  }
  return http(proxyUrl);
}

// ---------------------------------------------------------------------------
//  Create dynamic Wagmi config
// ---------------------------------------------------------------------------
export function createDynamicWagmiConfig(
  chainConfigs: BackendChainConfig[],
): Config | null {
  if (chainConfigs.length === 0) return null;

  const chains: [Chain, ...Chain[]] = [] as unknown as [Chain, ...Chain[]];
  const transports: Record<number, Transport> = {};

  for (const cfg of chainConfigs) {
    const viemChain = getViemChainById(cfg.chainId);
    if (!viemChain) {
      console.warn(`[DynamicConfig] No viem chain definition for chainId ${cfg.chainId}`);
      continue;
    }
    chains.push(viemChain);
    // Use the first public HTTP RPC from viem chain definition as fallback
    const publicRpc = viemChain.rpcUrls?.default?.http?.[0];
    transports[cfg.chainId] = buildTransport(cfg.chainId, publicRpc);
  }

  if (chains.length === 0) return null;

  return createConfig({
    chains,
    transports: transports as any,
    ssr: true,
  });
}
