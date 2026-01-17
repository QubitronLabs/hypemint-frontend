/**
 * HypeMint Contract Configuration
 *
 * Contract addresses and chain configuration
 */

// Polygon Mainnet Chain ID
export const POLYGON_CHAIN_ID = 137;

// Polygon Amoy Testnet Chain ID
export const POLYGON_AMOY_CHAIN_ID = 80002;

// Active chain (change for production)
export const ACTIVE_CHAIN_ID = POLYGON_AMOY_CHAIN_ID;

// Contract addresses - UPDATE THESE AFTER DEPLOYMENT
export const CONTRACT_ADDRESSES = {
  // Polygon Mainnet
  [POLYGON_CHAIN_ID]: {
    factory: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenImplementation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    bondingCurveImplementation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
  // Polygon Amoy Testnet
  [POLYGON_AMOY_CHAIN_ID]: {
    factory: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenImplementation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    bondingCurveImplementation: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
} as const;

// Get contract address for active chain
export function getContractAddress(
  contract: "factory" | "tokenImplementation" | "bondingCurveImplementation"
): `0x${string}` {
  return CONTRACT_ADDRESSES[ACTIVE_CHAIN_ID][contract];
}

// Default creation fee in wei (0.01 MATIC)
export const DEFAULT_CREATION_FEE = BigInt("10000000000000000"); // 0.01 MATIC

// Default slippage tolerance (5%)
export const DEFAULT_SLIPPAGE_BPS = 500;

// Graduation threshold in USD
export const GRADUATION_THRESHOLD_USD = 69000;

// HypeBoost default configuration
export const HYPE_BOOST_DEFAULTS = {
  maxWalletPercent: 200, // 2%
  snipeProtectionBlocks: 5,
  vestingDuration: 3600, // 1 hour
  immediateUnlockPercent: 2500, // 25%
};

// Fee configuration (basis points)
export const FEE_CONFIG = {
  protocolFee: 100, // 1%
  creatorFee: 100, // 1%
};
