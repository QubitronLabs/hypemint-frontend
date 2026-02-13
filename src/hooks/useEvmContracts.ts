/**
 * EVM Contract Interaction Hooks
 *
 * Re-export of the existing Wagmi/Viem-based contract hooks.
 * This file preserves backward compatibility while the codebase
 * migrates to use useUniversalTrade for chain-agnostic trading.
 *
 * All existing Wagmi logic remains in useContracts.ts (unchanged).
 */

export {
  useNativeBalance,
  useCreationFee,
  useCreateToken,
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
  CreateTokenParams,
  CreateTokenResult,
  BuyParams,
  SellParams,
} from "./useContracts";
