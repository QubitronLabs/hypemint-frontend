export { useAuth, useCurrentUser } from "./useAuth";
export * from "./useTokens";
export * from "./useTrades";
export * from "./useUsers";
export * from "./useWebSocket";
export * from "./useWatchlist";
export * from "./useAlerts";
export * from "./useOrders";
export * from "./useLeaderboard";
export * from "./useBlockchainSync";
export {
	usePersistedTabs,
	useLocalTabs,
	useSmartTabs,
} from "./usePersistedTabs";
export {
	useGlobalNetwork,
	useActiveChainId,
	useIsOnChain,
	useNativeCurrency,
	useNativeCurrencySymbol,
	type NetworkInfo,
	type NetworkState,
} from "./useNetwork";
export {
	useNativeBalance,
	useCreationFee,
	useCreateToken as useCreateTokenOnChain,
	useActiveEvmChainId,
	useBondingCurveState,
	useBuyQuote,
	useSellQuote,
	useBuyTokens,
	useSellTokens,
	useTokenBalance,
	useApproveToken,
	useTokenAllowance,
	useVestingInfo,
	useClaimVested,
} from "./useContracts";
export type {
	CreateTokenParams as OnChainCreateTokenParams,
	CreateTokenResult,
	BuyParams,
	SellParams,
} from "./useContracts";

// === Multichain Hooks ===
export { useUniversalTrade } from "./useUniversalTrade";
export type {
	ChainType,
	UniversalTradeParams,
	UniversalBuyParams,
	UniversalSellParams,
	UniversalTradeReturn,
} from "./useUniversalTrade";

// Chain-aware balance (automatically delegates to EVM or Solana)
export { useChainNativeBalance } from "./useChainNativeBalance";
export type { ChainBalance } from "./useChainNativeBalance";

// EVM-specific re-exports live in ./useEvmContracts.ts
// Import directly from "@/hooks/useEvmContracts" for explicit EVM chain usage.
// Not re-exported here to avoid duplicate export conflicts with useContracts.

// Solana hooks
export {
	useSolanaCreateToken,
	useSolanaBuyTokens,
	useSolanaSellTokens,
	useSolanaTokenBalance,
	useSolanaNativeBalance,
	useSolanaBondingCurveState,
	calculateTokensForSol,
	calculateSolForTokens,
	calculateCurrentPrice,
} from "./useSolanaContracts";

// Contract config (dynamic from backend)
export { useContractConfig, useContractConfigStore } from "./useContractConfig";
