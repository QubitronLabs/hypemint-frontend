"use client";

/**
 * On-Chain Trading Panel Component
 * Real blockchain trading interface using Wagmi/Viem (EVM) or Solana hooks
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther, parseEther, type Address } from "viem";
import {
	ArrowUpCircle,
	ArrowDownCircle,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	Loader2,
	CheckCircle2,
	XCircle,
	ExternalLink,
	Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatNumber } from "@/lib/utils";
import {
	useBuyTokens,
	useSellTokens,
	useBuyQuote,
	useSellQuote,
	useBondingCurveState,
	useTokenBalance,
	useNativeBalance,
	useApproveToken,
	useTokenAllowance,
	useAuth,
	useNativeCurrencySymbol,
	useSolanaBuyTokens,
	useSolanaSellTokens,
	useSolanaTokenBalance,
	useSolanaNativeBalance,
	useSolanaBondingCurveState,
} from "@/hooks";
import { getTxUrl, isSolanaChain } from "@/lib/wagmi";
import { syncTrade, getQuoteFromNative } from "@/lib/api/trades";
import { toast } from "sonner";
import { useChainId, useNetworkStore } from "@/lib/network/store";
import { EvmWalletConnector } from "../network/NetworkStateSynchronizer";
import { WalletConnector } from "@dynamic-labs/sdk-react-core";
import { type SolanaWalletConnector } from "@dynamic-labs/solana-core";
import { SUPPORTED_CHAINS, getNativeSymbolForChain } from "@/types";

// Note: Trade recording is now handled by backend blockchain event listener
// Frontend only needs to display confirmation UI

interface OnChainTradingPanelProps {
	tokenId: string;
	tokenAddress: Address;
	bondingCurveAddress: Address;
	tokenSymbol: string;
	tokenName: string;
	nativeSymbol: string;
	currentPrice: string;
	chainType?: "EVM" | "SOLANA";
	className?: string;
	chainId: number;
	/** Backend CPMM balance for sell display (raw 6-decimal string). Solana on-chain SPL balance is always 0 for CPMM tokens. */
	backendTokenBalance?: string;
}

type TradeType = "buy" | "sell";

// Solana formatting helpers
// SOL = 9 decimals (lamports), SPL Token = 6 decimals (matching pump.fun)
function formatSol(lamports: bigint): string {
	return (Number(lamports) / 1e9).toString();
}

function formatSolanaToken(amount: bigint): string {
	// SPL Token = 9 decimals
	return (Number(amount) / 1e9).toString();
}

export function OnChainTradingPanel({
	tokenId,
	tokenAddress,
	nativeSymbol,
	bondingCurveAddress,
	tokenSymbol,
	tokenName,
	currentPrice,
	chainType = "EVM",
	chainId,
	className,
	backendTokenBalance,
}: OnChainTradingPanelProps) {
	const { isAuthenticated, setShowAuthFlow, primaryWallet } = useAuth();
	const [tradeType, setTradeType] = useState<TradeType>("buy");
	const [amount, setAmount] = useState("");
	const [slippage, setSlippage] = useState(5); // 5% default
	const appChainId = useChainId();
	const { setNetworkData } = useNetworkStore();
	// Normalize chainId to number for consistent comparison
	const normalizedChainId = Number(chainId);
	// Track if approval just completed to prevent button flicker
	const [justApproved, setJustApproved] = useState(false);

	const primaryWalletConnector = primaryWallet?.connector as WalletConnector &
		EvmWalletConnector;

	const isSolana = chainType === "SOLANA" || isSolanaChain(normalizedChainId);

	// Sync network store chainId when viewing a Solana token and the store
	// doesn't already have a valid Solana chain. This handles the case where
	// the user navigates directly to a token URL from an EVM session.
	// IMPORTANT: Do NOT override when the store already has a Solana chain
	// (e.g. 900 vs 901) — the wallet's network from NetworkStateSynchronizer
	// is the source of truth. Overriding causes flip-flop between mainnet/devnet.
	useEffect(() => {
		if (isSolana && normalizedChainId && !isSolanaChain(appChainId ?? 0)) {
			setNetworkData({
				network: {
					name:
						normalizedChainId === 900 ? "Solana" : "Solana Devnet",
					vanityName:
						normalizedChainId === 900 ? "Solana" : "Solana Devnet",
				},
				chainId: normalizedChainId,
				chainLogo: "/chains/solana.svg",
				nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
				activeChainType: "SOLANA",
			});
		}
	}, [isSolana, normalizedChainId, appChainId, setNetworkData]);

	// Max decimal places allowed based on chain/trade type
	// Solana: SOL and tokens both use 9 decimals
	// EVM: native and tokens use 18 but we limit to 8 for UX
	const getMaxDecimals = useCallback(
		(type: TradeType) => {
			if (isSolana) return 9;
			return 8; // EVM: practical limit
		},
		[isSolana],
	);

	const handleAmountChange = useCallback(
		(value: string) => {
			// Allow empty or just a dot for typing in progress
			if (value === "" || value === ".") {
				setAmount(value);
				return;
			}
			// Strip non-numeric except dot
			const cleaned = value.replace(/[^0-9.]/g, "");
			const parts = cleaned.split(".");
			if (parts.length > 2) return; // Multiple dots, reject

			const maxDec = getMaxDecimals(tradeType);
			if (parts.length === 2 && parts[1].length > maxDec) {
				// Truncate excess decimals
				setAmount(`${parts[0]}.${parts[1].slice(0, maxDec)}`);
				return;
			}
			setAmount(cleaned);
		},
		[tradeType, getMaxDecimals],
	);

	// Check if connected wallet type matches token's blockchain platform
	// Only show mismatch when a wallet is actually connected (primaryWallet != null)
	// isAuthenticated alone isn't sufficient since JWT persists in localStorage
	const connectedWalletIsSolana = primaryWallet?.chain === "SOL";
	const walletPlatformMismatch =
		isAuthenticated &&
		!!primaryWallet &&
		((isSolana && !connectedWalletIsSolana) ||
			(!isSolana && connectedWalletIsSolana));

	// Determine the correct native symbol from the token's chainId
	// Always prefer chain-based lookup over the API prop to avoid stale/incorrect values
	const effectiveNativeSymbol = useMemo(() => {
		if (isSolana) return "SOL";
		return getNativeSymbolForChain(normalizedChainId);
	}, [isSolana, normalizedChainId]);

	// Get dynamic native currency symbol

	// ========== EVM Hooks (always called for React rules) ==========
	const { data: evmNativeBalance, refetch: refetchEvmNativeBalance } =
		useNativeBalance();
	const { data: evmTokenBalance, refetch: refetchEvmTokenBalance } =
		useTokenBalance(
			isSolana
				? ("0x0000000000000000000000000000000000000000" as Address)
				: tokenAddress,
		);

	// ========== Solana Hooks (always called for React rules) ==========
	const { data: solTokenBalance, refetch: refetchSolTokenBalance } =
		useSolanaTokenBalance(isSolana ? tokenAddress : undefined);
	const { data: solNativeBalance, refetch: refetchSolNativeBalance } =
		useSolanaNativeBalance();

	// ========== Unified balance access ==========
	const nativeBalance = isSolana ? solNativeBalance : evmNativeBalance;
	// For Solana: use backend CPMM balance instead of on-chain SPL (which is always 0 for CPMM tokens)
	const tokenBalance = isSolana
		? backendTokenBalance
			? BigInt(backendTokenBalance)
			: solTokenBalance
		: evmTokenBalance;
	const refetchNativeBalance = isSolana
		? refetchSolNativeBalance
		: refetchEvmNativeBalance;
	const refetchTokenBalance = isSolana
		? refetchSolTokenBalance
		: refetchEvmTokenBalance;

	// Format helpers based on chain type
	const formatNativeDisplay = useCallback(
		(value: bigint | undefined): string => {
			if (!value) return "0";
			return isSolana ? formatSol(value) : formatEther(value);
		},
		[isSolana],
	);

	const formatTokenDisplay = useCallback(
		(value: bigint | undefined): string => {
			if (!value) return "0";
			return isSolana ? formatSolanaToken(value) : formatEther(value);
		},
		[isSolana],
	);

	// Re-fetch balances when chain changes (e.g. switching devnet ↔ mainnet)
	const prevChainRef = useRef(normalizedChainId);
	useEffect(() => {
		if (prevChainRef.current !== normalizedChainId) {
			prevChainRef.current = normalizedChainId;
			refetchNativeBalance();
			refetchTokenBalance();
		}
	}, [normalizedChainId, refetchNativeBalance, refetchTokenBalance]);

	// Debug logging for balance
	// useEffect(() => {
	// 	console.log("[OnChainTrading] Token balance data:", {
	// 		tokenAddress,
	// 		bondingCurveAddress,
	// 		userAddress: address,
	// 		tokenBalance: tokenBalance?.toString(),
	// 		isLoadingBalance,
	// 	});
	// }, [
	// 	tokenAddress,
	// 	bondingCurveAddress,
	// 	address,
	// 	tokenBalance,
	// 	isLoadingBalance,
	// ]);

	// Quotes
	const { data: buyQuote, isLoading: isBuyQuoteLoading } = useBuyQuote(
		isSolana
			? ("0x0000000000000000000000000000000000000000" as Address)
			: bondingCurveAddress,
		tradeType === "buy" && !isSolana ? amount : "",
	);
	const { data: sellQuote, isLoading: isSellQuoteLoading } = useSellQuote(
		isSolana
			? ("0x0000000000000000000000000000000000000000" as Address)
			: bondingCurveAddress,
		tradeType === "sell" && !isSolana ? amount : "",
	);

	// Solana bonding curve state for price impact calculation
	const { data: solanaCurveState } = useSolanaBondingCurveState(
		isSolana ? (tokenAddress as string) : undefined,
	);

	// EVM bonding curve state for accurate on-chain spot price
	const { currentPrice: evmOnChainPrice } = useBondingCurveState(
		isSolana ? undefined : bondingCurveAddress,
	);

	// ========== CPMM Quote for Solana buy estimates ==========
	const [cpmmEstimate, setCpmmEstimate] = useState<number | null>(null);
	const [cpmmLoading, setCpmmLoading] = useState(false);
	const cpmmDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		// Only for Solana buys with a valid amount
		if (!isSolana || tradeType !== "buy") {
			setCpmmEstimate(null);
			setCpmmLoading(false);
			return;
		}
		// Skip calculations when user has zero native balance
		if (nativeBalance?.value !== undefined && nativeBalance.value === 0n) {
			setCpmmEstimate(null);
			setCpmmLoading(false);
			return;
		}
		const parsed = parseFloat(amount);
		if (!parsed || parsed <= 0) {
			setCpmmEstimate(null);
			setCpmmLoading(false);
			return;
		}

		setCpmmLoading(true);

		if (cpmmDebounceRef.current) clearTimeout(cpmmDebounceRef.current);
		cpmmDebounceRef.current = setTimeout(async () => {
			try {
				// Convert SOL to lamports (9 decimals)
				const lamports = Math.floor(parsed * 1e9).toString();
				const quote = await getQuoteFromNative(
					tokenId,
					lamports,
					normalizedChainId,
				);
				// tokenAmount from backend is in 9-decimal raw units
				const humanTokens = parseFloat(quote.tokenAmount) / 1e9;
				setCpmmEstimate(humanTokens);
			} catch {
				setCpmmEstimate(null);
			} finally {
				setCpmmLoading(false);
			}
		}, 300);

		return () => {
			if (cpmmDebounceRef.current) clearTimeout(cpmmDebounceRef.current);
		};
	}, [
		isSolana,
		tradeType,
		amount,
		tokenId,
		normalizedChainId,
		nativeBalance,
	]);

	// Allowance check for selling (EVM only — Solana uses SPL ATA, no allowances)
	const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
		isSolana
			? ("0x0000000000000000000000000000000000000000" as Address)
			: tokenAddress,
		isSolana
			? ("0x0000000000000000000000000000000000000000" as Address)
			: bondingCurveAddress,
	);

	// ========== EVM Trade hooks ==========
	const {
		buy: evmBuy,
		isBuying: isEvmBuying,
		isConfirming: isEvmBuyConfirming,
		isConfirmed: isEvmBuyConfirmed,
		isFailed: isEvmBuyFailed,
		txHash: evmBuyTxHash,
		error: evmBuyError,
		reset: resetEvmBuy,
	} = useBuyTokens();

	const {
		sell: evmSell,
		isSelling: isEvmSelling,
		isConfirming: isEvmSellConfirming,
		isConfirmed: isEvmSellConfirmed,
		isFailed: isEvmSellFailed,
		txHash: evmSellTxHash,
		error: evmSellError,
		reset: resetEvmSell,
	} = useSellTokens();

	// ========== Solana Trade hooks ==========
	const {
		buy: solanaBuy,
		isBuying: isSolanaBuying,
		isConfirming: isSolanaBuyConfirming,
		isConfirmed: isSolanaBuyConfirmed,
		isFailed: isSolanaBuyFailed,
		txSignature: solanaBuyTxHash,
		error: solanaBuyError,
		reset: resetSolanaBuy,
	} = useSolanaBuyTokens();

	const {
		sell: solanaSell,
		isSelling: isSolanaSelling,
		isConfirming: isSolanaSellConfirming,
		isConfirmed: isSolanaSellConfirmed,
		isFailed: isSolanaSellFailed,
		txSignature: solanaSellTxHash,
		error: solanaSellError,
		reset: resetSolanaSell,
	} = useSolanaSellTokens();

	// ========== Unified trade state ==========
	const isBuying = isSolana ? isSolanaBuying : isEvmBuying;
	const isBuyConfirming = isSolana
		? isSolanaBuyConfirming
		: isEvmBuyConfirming;
	const isBuyConfirmed = isSolana ? isSolanaBuyConfirmed : isEvmBuyConfirmed;
	const isBuyFailed = isSolana ? isSolanaBuyFailed : isEvmBuyFailed;
	const buyTxHash = isSolana ? solanaBuyTxHash : evmBuyTxHash;
	const buyError = isSolana ? solanaBuyError : evmBuyError;
	const resetBuy = isSolana ? resetSolanaBuy : resetEvmBuy;

	const isSelling = isSolana ? isSolanaSelling : isEvmSelling;
	const isSellConfirming = isSolana
		? isSolanaSellConfirming
		: isEvmSellConfirming;
	const isSellConfirmed = isSolana
		? isSolanaSellConfirmed
		: isEvmSellConfirmed;
	const isSellFailed = isSolana ? isSolanaSellFailed : isEvmSellFailed;
	const sellTxHash = isSolana ? solanaSellTxHash : evmSellTxHash;
	const sellError = isSolana ? solanaSellError : evmSellError;
	const resetSell = isSolana ? resetSolanaSell : resetEvmSell;

	const {
		approve,
		isApproving,
		isConfirming: isApproveConfirming,
		isConfirmed: isApproveConfirmed,
		error: approveError,
		reset: resetApprove,
	} = useApproveToken();

	// Refs to track if we've already handled success/fail states (prevents re-triggering on focus)
	const handledBuyConfirmedRef = useRef<string | null>(null);
	const handledBuyFailedRef = useRef<string | null>(null);
	const handledSellConfirmedRef = useRef<string | null>(null);
	const handledSellFailedRef = useRef<string | null>(null);

	// Computed values
	// Note: Trades are now recorded automatically by backend blockchain event listener
	const isLoading = isBuying || isSelling || isApproving;
	const isConfirming =
		isBuyConfirming || isSellConfirming || isApproveConfirming;
	const isConfirmed = isBuyConfirmed || isSellConfirmed;
	const isFailed = isBuyFailed || isSellFailed;
	const txHash = buyTxHash || sellTxHash;
	const error = buyError || sellError || approveError;

	const handleNetworkChange = () => {
		// Solana: switch the Dynamic.xyz wallet connector's network,
		// which will trigger NetworkStateSynchronizer to update the store.
		// Map our internal chain IDs to Dynamic's Solana network IDs:
		//   900 (mainnet) → 101, 901 (devnet) → 103
		if (isSolana) {
			const dynamicNetworkId = normalizedChainId === 900 ? 101 : 103;

			const connector =
				primaryWallet?.connector as unknown as SolanaWalletConnector;
			if (connector?.switchNetwork) {
				connector
					.switchNetwork({ networkChainId: dynamicNetworkId })
					.then(() => {
						// NetworkStateSynchronizer will pick up the change and
						// update the store with the correct chainId and name.
					})
					.catch((err: unknown) => {
						console.error(
							"[OnChainTradingPanel] Solana network switch failed:",
							err,
						);
						// Fallback: manually update store if connector switch fails
						setNetworkData({
							network: {
								name:
									normalizedChainId === 900
										? "Solana"
										: "Solana Devnet",
								vanityName:
									normalizedChainId === 900
										? "Solana"
										: "Solana Devnet",
							},
							chainId: normalizedChainId,
							chainLogo: "/chains/solana.svg",
							nativeCurrency: {
								name: "SOL",
								symbol: "SOL",
								decimals: 9,
							},
							activeChainType: "SOLANA",
						});
					});
			} else {
				// No connector available — just update store directly
				setNetworkData({
					network: {
						name:
							normalizedChainId === 900
								? "Solana"
								: "Solana Devnet",
						vanityName:
							normalizedChainId === 900
								? "Solana"
								: "Solana Devnet",
					},
					chainId: normalizedChainId,
					chainLogo: "/chains/solana.svg",
					nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
					activeChainType: "SOLANA",
				});
			}
			return;
		}

		primaryWalletConnector
			.switchNetwork({ networkChainId: normalizedChainId })
			.then(() => {
				const currentNetworkConfig =
					primaryWalletConnector.evmNetworks?.find(
						(net) => net.chainId === normalizedChainId,
					);
				if (!currentNetworkConfig) {
					setNetworkData({
						network: { name: `Chain ${normalizedChainId}` },
						chainId: normalizedChainId,
						chainLogo: null,
						nativeCurrency: null,
						activeChainType: "EVM",
					});
				} else {
					const networkName =
						currentNetworkConfig.vanityName ||
						currentNetworkConfig.name;
					const chainLogo =
						currentNetworkConfig.iconUrls?.[0] || null;

					const nativeCurrency = currentNetworkConfig.nativeCurrency
						? {
								name: currentNetworkConfig.nativeCurrency.name,
								symbol: currentNetworkConfig.nativeCurrency
									.symbol,
								decimals:
									currentNetworkConfig.nativeCurrency
										.decimals,
								iconUrl:
									currentNetworkConfig.nativeCurrency.iconUrl,
							}
						: null;

					setNetworkData({
						network: {
							name: networkName,
							vanityName: currentNetworkConfig.vanityName,
						},
						chainId: normalizedChainId,
						chainLogo,
						nativeCurrency,
						activeChainType: "EVM",
					});
				}
			})
			.catch((err: unknown) => {
				console.error(
					"[OnChainTradingPanel] Failed to switch network:",
					err,
				);
				toast.error("Failed to switch network. Please try manually.");
			});
	};

	// Check if needs approval for sell (EVM only - Solana doesn't need approvals)
	const needsApproval = useMemo(() => {
		if (isSolana) return false; // Solana doesn't use ERC-20 allowances
		if (tradeType !== "sell") return false;
		// If approval just completed, don't require approval again
		if (justApproved) return false;

		// If no amount entered, check if allowance is zero or insufficient for any meaningful trade
		if (!amount) {
			return allowance !== undefined && allowance === 0n;
		}

		// If amount is entered, check if allowance is sufficient for that specific amount
		try {
			const amountWei = parseEther(amount);
			return allowance !== undefined && allowance < amountWei;
		} catch {
			return false;
		}
	}, [tradeType, amount, allowance, justApproved]);

	// Check if user has zero balance for the active trade side
	const hasZeroBalance = useMemo(() => {
		if (!isAuthenticated) return false;
		if (tradeType === "buy") {
			if (isSolana) {
				// Solana: treat undefined/null as zero to prevent premature trades during network switch
				if (
					nativeBalance?.value === undefined ||
					nativeBalance?.value === null
				)
					return true;
				return nativeBalance.value === 0n;
			}
			// EVM: only trigger for explicit 0 (Wagmi manages loading state separately)
			if (
				nativeBalance?.value !== undefined &&
				nativeBalance.value === 0n
			)
				return true;
			return false;
		}
		// Sell: check token balance
		if (isSolana) {
			if (tokenBalance === undefined || tokenBalance === null)
				return true;
			return BigInt(tokenBalance.toString()) === 0n;
		}
		// EVM sell: only explicit 0
		if (
			tokenBalance !== undefined &&
			tokenBalance !== null &&
			BigInt(tokenBalance.toString()) === 0n
		)
			return true;
		return false;
	}, [tradeType, nativeBalance, tokenBalance, isAuthenticated, isSolana]);

	// Human-readable zero balance error message
	const zeroBalanceMessage = useMemo(() => {
		if (!hasZeroBalance) return "";
		// Check if balance is still loading (undefined)
		const isBalanceLoading =
			tradeType === "buy"
				? nativeBalance?.value === undefined ||
					nativeBalance?.value === null
				: tokenBalance === undefined || tokenBalance === null;
		if (isBalanceLoading) return "Checking balance...";
		if (tradeType === "buy") {
			return `Insufficient balance: you have 0 ${nativeSymbol}`;
		}
		return `Insufficient balance: you have 0 ${tokenSymbol}`;
	}, [
		hasZeroBalance,
		tradeType,
		nativeBalance,
		tokenBalance,
		effectiveNativeSymbol,
		tokenSymbol,
	]);

	// Check if amount exceeds available balance (both buy and sell)
	const exceedsBalance = useMemo(() => {
		if (hasZeroBalance) return true;
		if (!amount) return false;
		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) return false;

		if (tradeType === "buy") {
			// Check native balance for buys
			if (!nativeBalance?.value) return false;
			const balanceHuman = parseFloat(
				formatNativeDisplay(nativeBalance.value),
			);
			return parsedAmount > balanceHuman;
		} else {
			// Check token balance for sells
			if (!tokenBalance) return false;
			const balanceDisplay = parseFloat(
				formatTokenDisplay(tokenBalance as bigint),
			);
			return parsedAmount > balanceDisplay;
		}
	}, [
		hasZeroBalance,
		tradeType,
		amount,
		nativeBalance,
		tokenBalance,
		formatNativeDisplay,
		formatTokenDisplay,
	]);

	// Human-readable balance string for the error message
	const balanceErrorMessage = useMemo(() => {
		if (!exceedsBalance) return "";
		// Prioritize exact zero-balance message
		if (hasZeroBalance) return zeroBalanceMessage;
		if (tradeType === "buy") {
			const raw = nativeBalance?.value
				? formatNativeDisplay(nativeBalance.value)
				: "0";
			const bal = parseFloat(raw).toFixed(4);
			return `Insufficient balance: you have ${bal} ${nativeSymbol}`;
		}
		const raw = tokenBalance
			? formatTokenDisplay(tokenBalance as bigint)
			: "0";
		const bal = parseFloat(raw).toFixed(4);
		return `Insufficient balance: you have ${bal} ${tokenSymbol}`;
	}, [
		exceedsBalance,
		hasZeroBalance,
		zeroBalanceMessage,
		tradeType,
		nativeBalance,
		tokenBalance,
		formatNativeDisplay,
		formatTokenDisplay,
		effectiveNativeSymbol,
		tokenSymbol,
	]);

	// Check if amount is below the minimum representable unit
	const belowMinimum = useMemo(() => {
		if (!amount) return false;
		const parsed = parseFloat(amount);
		if (isNaN(parsed) || parsed <= 0) return false;
		if (isSolana) {
			if (tradeType === "sell") {
				// SPL token min = 0.000001 (1 raw unit with 6 decimals)
				return parsed < 0.000001;
			} else {
				// SOL min = 0.000000001 (1 lamport with 9 decimals)
				return parsed < 0.000000001;
			}
		}
		return false; // EVM handles precision internally
	}, [amount, tradeType, isSolana]);

	// Calculate trade metrics with safety checks
	const tradeMetrics = useMemo(() => {
		const parsedAmount = parseFloat(amount) || 0;
		const backendPrice = parseFloat(currentPrice) || 0.00001;
		// Use on-chain EVM price when available, otherwise fallback to backend price
		const evmSpotPrice = evmOnChainPrice
			? parseFloat(formatEther(evmOnChainPrice))
			: 0;
		const price =
			!isSolana && evmSpotPrice > 0 ? evmSpotPrice : backendPrice;

		// Skip calculations when user has zero balance for the active trade side
		const isZeroNativeBalance =
			nativeBalance?.value !== undefined && nativeBalance.value === 0n;
		const isZeroTokenBalance =
			tokenBalance !== undefined &&
			tokenBalance !== null &&
			BigInt(tokenBalance.toString()) === 0n;
		if (
			(tradeType === "buy" && isZeroNativeBalance) ||
			(tradeType === "sell" && isZeroTokenBalance)
		) {
			return {
				outputAmount: 0,
				fees: 0,
				effectivePrice: price,
				priceImpact: 0,
				isHighImpact: false,
				isUnreasonable: false,
			};
		}

		if (tradeType === "buy" && buyQuote) {
			const [tokenAmount, protocolFee, creatorFee] = buyQuote as [
				bigint,
				bigint,
				bigint,
			];
			const tokensOut = parseFloat(formatEther(tokenAmount));
			console.log({ buyQuote, tokensOut });
			// const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
			// const effectivePrice = tokensOut > 0 ? parsedAmount / tokensOut : 0;
			// const priceImpact =
			// 	price > 0 ? ((effectivePrice - price) / price) * 100 : 0;

			// Safety check for unreasonable values
			const isUnreasonable = !isFinite(tokensOut) || tokensOut > 1e18;
			// || !isFinite(effectivePrice);

			return {
				outputAmount: isUnreasonable ? 0 : tokensOut,
				// fees: isFinite(totalFees) ? totalFees : 0,
				// effectivePrice: isUnreasonable ? 0 : effectivePrice,
				// priceImpact: isFinite(priceImpact) ? Math.abs(priceImpact) : 0,
				// isHighImpact: Math.abs(priceImpact) > 5,
				fees: 0,
				effectivePrice: 0,
				priceImpact: 0,
				isHighImpact: false,
				isUnreasonable,
			};
		}

		if (tradeType === "sell" && sellQuote) {
			const [maticAmount, protocolFee, creatorFee] = sellQuote as [
				bigint,
				bigint,
				bigint,
			];
			const maticOut = parseFloat(formatEther(maticAmount));
			// const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
			// const effectivePrice =
			// 	parsedAmount > 0 ? maticOut / parsedAmount : 0;
			// const priceImpact =
			// 	price > 0 ? ((price - effectivePrice) / price) * 100 : 0;

			// Safety check for unreasonable values (e.g., more than 1 billion MATIC)
			const isUnreasonable = !isFinite(maticOut) || maticOut > 1e9;
			// || !isFinite(effectivePrice);

			return {
				outputAmount: isUnreasonable ? 0 : maticOut,
				// fees: isFinite(totalFees) ? totalFees : 0,
				// effectivePrice: isUnreasonable ? 0 : effectivePrice,
				// priceImpact: isFinite(priceImpact) ? Math.abs(priceImpact) : 0,
				// isHighImpact: Math.abs(priceImpact) > 5,
				fees: 0,
				effectivePrice: 0,
				priceImpact: 0,
				isHighImpact: false,
				isUnreasonable,
			};
		}

		// Fallback: estimate using spot price when on-chain quote not available
		if (parsedAmount > 0 && price > 0) {
			if (tradeType === "buy") {
				const estimatedTokens = parsedAmount / price;
				return {
					outputAmount: estimatedTokens,
					fees: 0,
					effectivePrice: price,
					priceImpact: 0,
					isHighImpact: false,
					isUnreasonable:
						!isFinite(estimatedTokens) || estimatedTokens > 1e18,
				};
			} else {
				const estimatedNative = parsedAmount * price;
				return {
					outputAmount: estimatedNative,
					fees: 0,
					effectivePrice: price,
					priceImpact: 0,
					isHighImpact: false,
					isUnreasonable:
						!isFinite(estimatedNative) || estimatedNative > 1e9,
				};
			}
		}

		return {
			outputAmount: 0,
			fees: 0,
			effectivePrice: price,
			priceImpact: 0,
			isHighImpact: false,
			isUnreasonable: false,
		};
	}, [
		amount,
		tradeType,
		currentPrice,
		buyQuote,
		sellQuote,
		isSolana,
		solanaCurveState,
		evmOnChainPrice,
		nativeBalance,
		tokenBalance,
	]);

	// Trade recording is handled by backend blockchain event listener + instant sync API.
	// Frontend calls syncTrade() after confirmation for instant data updates.

	// Refetch balances and sync when trades are confirmed
	// Note: Backend event listener records the trade independently via on-chain events
	useEffect(() => {
		if (
			isBuyConfirmed &&
			buyTxHash &&
			handledBuyConfirmedRef.current !== buyTxHash
		) {
			handledBuyConfirmedRef.current = buyTxHash;
			console.log("[OnChainTrading] Buy trade confirmed:", buyTxHash);
			toast.success("Buy transaction confirmed!", {
				id: "trade-result",
				description: `Transaction successful`,
				action: {
					label: "View",
					onClick: () =>
						window.open(
							getTxUrl(buyTxHash, normalizedChainId),
							"_blank",
						),
				},
			});
			// Instantly sync trade to backend for fast UI updates
			// Skip for Solana — the buy hook handles syncTrade with correct amounts
			if (!isSolana) {
				syncTrade({
					txHash: buyTxHash,
					tokenId,
					chainId: normalizedChainId,
				})
					.then((res) =>
						console.log("[OnChainTrading] Buy sync result:", res),
					)
					.catch((err) =>
						console.warn(
							"[OnChainTrading] Buy sync failed (event listener will catch up):",
							err,
						),
					);
			}
			// Clear amount immediately
			setAmount("");
			// Refetch balances after confirmed trade
			setTimeout(() => {
				refetchNativeBalance();
				refetchTokenBalance();
			}, 2000);
			// Auto-reset button state after 2 seconds
			setTimeout(() => {
				resetBuy();
				handledBuyConfirmedRef.current = null;
			}, 2000);
		}
	}, [
		isBuyConfirmed,
		buyTxHash,
		tokenId,
		normalizedChainId,
		isSolana,
		refetchNativeBalance,
		refetchTokenBalance,
	]);

	// Show toast for failed buy trades
	useEffect(() => {
		if (
			isBuyFailed &&
			buyTxHash &&
			handledBuyFailedRef.current !== buyTxHash
		) {
			handledBuyFailedRef.current = buyTxHash;
			console.log("[OnChainTrading] Buy trade failed:", buyTxHash);
			toast.error("Buy transaction failed!", {
				id: "trade-result",
				description: "Transaction reverted on-chain",
				action: {
					label: "View",
					onClick: () =>
						window.open(
							getTxUrl(buyTxHash, normalizedChainId),
							"_blank",
						),
				},
			});
			// Clear amount immediately
			setAmount("");
			// Auto-reset button state after 2 seconds
			setTimeout(() => {
				resetBuy();
				handledBuyFailedRef.current = null;
			}, 2000);
		}
	}, [isBuyFailed, buyTxHash]);

	// Sync sell trade when confirmed
	useEffect(() => {
		if (
			isSellConfirmed &&
			sellTxHash &&
			handledSellConfirmedRef.current !== sellTxHash
		) {
			handledSellConfirmedRef.current = sellTxHash;
			console.log("[OnChainTrading] Sell trade confirmed:", sellTxHash);
			toast.success("Sell transaction confirmed!", {
				id: "trade-result",
				description: `Transaction successful`,
				action: {
					label: "View",
					onClick: () =>
						window.open(
							getTxUrl(sellTxHash, normalizedChainId),
							"_blank",
						),
				},
			});
			// Instantly sync trade to backend for fast UI updates
			// Skip for Solana — the sell hook handles syncTrade with correct amounts
			if (!isSolana) {
				syncTrade({
					txHash: sellTxHash,
					tokenId,
					chainId: normalizedChainId,
				})
					.then((res) =>
						console.log("[OnChainTrading] Sell sync result:", res),
					)
					.catch((err) =>
						console.warn(
							"[OnChainTrading] Sell sync failed (event listener will catch up):",
							err,
						),
					);
			}
			// Clear amount immediately
			setAmount("");
			// Refetch balances after confirmed trade
			setTimeout(() => {
				refetchNativeBalance();
				refetchTokenBalance();
			}, 2000);
			// Auto-reset button state after 2 seconds
			setTimeout(() => {
				resetSell();
				handledSellConfirmedRef.current = null;
			}, 2000);
		}
	}, [
		isSellConfirmed,
		sellTxHash,
		tokenId,
		normalizedChainId,
		isSolana,
		refetchNativeBalance,
		refetchTokenBalance,
	]);

	// Show toast for failed sell trades
	useEffect(() => {
		if (
			isSellFailed &&
			sellTxHash &&
			handledSellFailedRef.current !== sellTxHash
		) {
			handledSellFailedRef.current = sellTxHash;
			console.log("[OnChainTrading] Sell trade failed:", sellTxHash);
			toast.error("Sell transaction failed!", {
				id: "trade-result",
				description: "Transaction reverted on-chain",
				action: {
					label: "View",
					onClick: () =>
						window.open(
							getTxUrl(sellTxHash, normalizedChainId),
							"_blank",
						),
				},
			});
			// Clear amount immediately
			setAmount("");
			// Auto-reset button state after 2 seconds
			setTimeout(() => {
				resetSell();
				handledSellFailedRef.current = null;
			}, 2000);
		}
	}, [isSellFailed, sellTxHash]);

	// Refetch allowance when approve is confirmed
	useEffect(() => {
		if (isApproveConfirmed) {
			console.log(
				"[OnChainTrading] Approve confirmed, refetching allowance",
			);
			// Set flag immediately to prevent button flicker
			setJustApproved(true);
			// Refetch allowance immediately (blockchain state is updated by now)
			refetchAllowance();
			toast.success("Approval confirmed! You can now sell tokens.");
			resetApprove();
			// Reset flag after a short delay
			setTimeout(() => {
				setJustApproved(false);
			}, 3000);
		}
	}, [isApproveConfirmed, refetchAllowance, resetApprove]);

	// Show toast for pre-submission errors (gas estimation, chain switch, etc.)
	useEffect(() => {
		if (error) {
			const msg = error.message || "Transaction failed";
			// Extract user-friendly message from common wagmi/viem errors
			let friendlyMsg = msg;
			if (
				msg.includes("User rejected") ||
				msg.includes("user rejected")
			) {
				friendlyMsg = "Transaction cancelled by user";
			} else if (
				msg.includes("insufficient funds") ||
				msg.includes("InsufficientFunds")
			) {
				friendlyMsg = "Insufficient balance for this transaction";
			} else if (msg.includes("exceeds the configured cap")) {
				friendlyMsg = "Gas fee too high — try again later";
			} else if (msg.length > 120) {
				friendlyMsg = msg.slice(0, 120) + "...";
			}
			toast.error(friendlyMsg, { id: "trade-error", duration: 5000 });
		}
	}, [error]);

	// Handle approve
	const handleApprove = async () => {
		if (!amount) return;
		try {
			const amountWei = parseEther(amount);
			// Approve max uint256 for convenience
			const maxApproval = BigInt(
				"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			);
			await approve(tokenAddress, bondingCurveAddress, maxApproval);
			toast.info("Approval request Sent!");
		} catch (err) {
			console.error("Approve failed:", err);
			toast.error("Approval failed");
		}
	};

	// Handle trade execution
	// Note: Backend event listener will automatically record trades from blockchain events
	const handleTrade = async () => {
		if (!isAuthenticated) {
			setShowAuthFlow(true);
			return;
		}
		if (!amount || parseFloat(amount) <= 0 || !isAuthenticated) return;
		// Prevent trading with zero balance
		if (hasZeroBalance) {
			toast.error(zeroBalanceMessage);
			return;
		}

		resetBuy();
		resetSell();

		try {
			if (tradeType === "buy") {
				toast.info("Confirm transaction in wallet...", { id: "trade" });

				if (isSolana) {
					// Solana buy
					const sig = await solanaBuy({
						bondingCurveAddress: bondingCurveAddress as string,
						solAmount: amount,
					});
					if (sig) {
						toast.info("Buy order submitted!", {
							id: "trade",
							description: `Tx: ${sig.slice(0, 10)}...`,
							action: {
								label: "View",
								onClick: () =>
									window.open(
										getTxUrl(sig, normalizedChainId),
										"_blank",
									),
							},
						});
					}
				} else {
					// EVM buy
					const hash = await evmBuy({
						bondingCurveAddress,
						maticAmount: amount,
						slippageBps: slippage * 100,
						chainId: normalizedChainId,
					});
					if (hash) {
						toast.info("Buy order submitted!", {
							id: "trade",
							description: `Tx: ${hash.slice(0, 10)}...`,
							action: {
								label: "View",
								onClick: () =>
									window.open(
										getTxUrl(hash, normalizedChainId),
										"_blank",
									),
							},
						});
					}
				}
			} else {
				// Check approval first (EVM only)
				if (!isSolana && needsApproval) {
					toast.error("Please approve tokens first");
					return;
				}

				toast.info("Confirm transaction in wallet...", { id: "trade" });

				if (isSolana) {
					// Solana sell
					const sig = await solanaSell({
						bondingCurveAddress: bondingCurveAddress as string,
						tokenAddress: tokenAddress as string,
						tokenAmount: amount,
					});
					if (sig) {
						toast.info("Sell order submitted!", {
							id: "trade",
							description: `Tx: ${sig.slice(0, 10)}...`,
							action: {
								label: "View",
								onClick: () =>
									window.open(
										getTxUrl(sig, normalizedChainId),
										"_blank",
									),
							},
						});
					}
				} else {
					// EVM sell
					// Calculate minMatic from sellQuote with slippage
					let minMaticStr = "0";
					if (sellQuote) {
						const [maticAmount] = sellQuote as [
							bigint,
							bigint,
							bigint,
						];
						// Apply slippage: minMatic = expectedMatic * (1 - slippage%)
						const slippageMultiplier = BigInt(
							10000 - slippage * 100,
						);
						const minMaticWei =
							(maticAmount * slippageMultiplier) / BigInt(10000);
						minMaticStr = formatEther(minMaticWei);
						console.log("[OnChainTrading] Sell with minMatic:", {
							expectedMatic: formatEther(maticAmount),
							slippage: slippage + "%",
							minMatic: minMaticStr,
						});
					}

					const hash = await evmSell({
						bondingCurveAddress,
						tokenAddress,
						tokenAmount: amount,
						minMatic: minMaticStr,
						slippageBps: slippage * 100,
						chainId: normalizedChainId,
					});
					if (hash) {
						toast.info("Sell order submitted!", {
							id: "trade",
							description: `Tx: ${hash.slice(0, 10)}...`,
							action: {
								label: "View",
								onClick: () =>
									window.open(
										getTxUrl(hash, normalizedChainId),
										"_blank",
									),
							},
						});
					}
				}
			}
		} catch (err) {
			console.error("Trade failed:", err);
			toast.error("Trade failed", { id: "trade" });
		}
	};

	// Quick amount buttons
	const quickAmounts =
		tradeType === "buy"
			? isSolana
				? ["0.01", "0.05", "0.1", "0.5"] // SOL amounts
				: ["0.1", "0.5", "1", "5"] // MATIC amounts
			: ["25%", "50%", "75%", "MAX"]; // Percentage of balance

	const handleQuickAmount = (qa: string) => {
		if (tradeType === "buy") {
			setAmount(qa);
		} else {
			// Calculate percentage of token balance
			if (!tokenBalance) return;
			const balance = parseFloat(
				formatTokenDisplay(tokenBalance as bigint),
			);
			let percentage = 1;
			if (qa === "25%") percentage = 0.25;
			else if (qa === "50%") percentage = 0.5;
			else if (qa === "75%") percentage = 0.75;

			if (qa === "MAX") {
				// Use raw balance string directly for 100% accuracy
				setAmount(formatTokenDisplay(tokenBalance as bigint));
			} else {
				setAmount((balance * percentage).toFixed(6));
			}
		}
	};

	// Reset on trade type change
	useEffect(() => {
		setAmount("");
		resetBuy();
		resetSell();
		resetApprove();
		// Reset justApproved flag when switching trade types
		setJustApproved(false);
	}, [tradeType]);

	return (
		<div
			className={cn(
				"bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden w-full max-w-full",
				className,
			)}
		>
			{/* Trade Type Tabs */}
			<div className="p-3 sm:p-4">
				<div className="flex bg-background/50 rounded-lg p-1 gap-1">
					<button
						onClick={() => setTradeType("buy")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md font-medium transition-all text-sm sm:text-base",
							tradeType === "buy"
								? "bg-linear-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<ArrowUpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						Buy
					</button>
					<button
						onClick={() => setTradeType("sell")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md font-medium transition-all text-sm sm:text-base",
							tradeType === "sell"
								? "bg-linear-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<ArrowDownCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						Sell
					</button>
				</div>
			</div>

			{/* Amount Input */}
			<div className="px-3 sm:px-4 pb-3 sm:pb-4">
				<div className="mb-3">
					<div className="flex justify-between items-center mb-1.5 gap-2">
						<label className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
							{tradeType === "buy"
								? `You Pay (${nativeSymbol})`
								: `You Sell (${tokenSymbol})`}
						</label>
						<span className="text-[10px] sm:text-xs text-muted-foreground truncate">
							Balance:{" "}
							{tradeType === "buy"
								? `${nativeBalance?.value ? formatNumber(formatNativeDisplay(nativeBalance.value)) : "0"} ${nativeSymbol}`
								: `${tokenBalance ? formatNumber(formatTokenDisplay(tokenBalance as bigint)) : "0"} ${tokenSymbol}`}
						</span>
					</div>
					<div className="relative">
						<Input
							type="number"
							placeholder="0.00"
							value={amount}
							onChange={(e) => handleAmountChange(e.target.value)}
							className={cn(
								"pr-14 sm:pr-16 text-base sm:text-lg font-medium bg-background/50",
								tradeType === "buy"
									? "focus-visible:border-green-500/70 focus-visible:ring-green-500/30"
									: "focus-visible:border-red-500/70 focus-visible:ring-red-500/30",
							)}
						/>
						<div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground">
							{tradeType === "buy" ? nativeSymbol : tokenSymbol}
						</div>
					</div>
				</div>

				{/* Quick Amount Buttons */}
				<div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
					{quickAmounts.map((qa) => (
						<button
							key={qa}
							onClick={() => handleQuickAmount(qa)}
							className={cn(
								"flex-1 py-1.5 text-xs font-medium bg-background/50 border border-border/50 rounded-md transition-colors",
								tradeType === "buy"
									? "hover:border-green-500/60 hover:bg-green-500/15"
									: "hover:border-red-500/60 hover:bg-red-500/15",
							)}
						>
							{qa}
						</button>
					))}
				</div>

				{/* Zero Balance Warning */}
				{/* {hasZeroBalance && (
					<div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
						<AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
						<span className="text-sm text-destructive font-medium">
							{zeroBalanceMessage}
						</span>
					</div>
				)} */}

				{/* Output Estimate */}
				<AnimatePresence mode="wait">
					{parseFloat(amount) > 0 && !hasZeroBalance && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="space-y-2 mb-4"
						>
							{/* Warning for unreasonable values */}
							{tradeMetrics.isUnreasonable && (
								<div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-destructive" />
									<span className="text-sm text-destructive">
										Calculation overflow - try a smaller
										amount
									</span>
								</div>
							)}

							<div className="p-3 bg-background/30 rounded-lg space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">
										You Receive
									</span>
									<span className="font-medium">
										{isBuyQuoteLoading ||
										isSellQuoteLoading ||
										cpmmLoading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : tradeMetrics.isUnreasonable ? (
											<span className="text-destructive">
												--
											</span>
										) : (
											<>
												{formatNumber(
													isSolana &&
														tradeType === "buy" &&
														cpmmEstimate !== null
														? cpmmEstimate
														: tradeMetrics.outputAmount,
												)}{" "}
												{tradeType === "buy"
													? tokenSymbol
													: nativeSymbol}
											</>
										)}
									</span>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Slippage Setting */}
				<div className="flex items-center justify-between mb-4 p-2 bg-background/30 rounded-lg">
					<span className="text-xs text-muted-foreground">
						Slippage Tolerance
					</span>
					<div className="flex gap-1">
						{[1, 3, 5, 10].map((s) => (
							<button
								key={s}
								onClick={() => setSlippage(s)}
								className={cn(
									"px-2 py-1 text-xs rounded transition-colors",
									slippage === s
										? tradeType === "buy"
											? "bg-green-500/25 text-green-300 border border-green-500/50"
											: "bg-red-500/25 text-red-300 border border-red-500/50"
										: "bg-background/50 hover:bg-background",
								)}
							>
								{s}%
							</button>
						))}
					</div>
				</div>

				{/* Execute Button */}

				<>
					{/* Trade Button - Merged with Approval functionality for sell */}
					<Button
						onClick={
							walletPlatformMismatch
								? undefined
								: appChainId !== normalizedChainId
									? handleNetworkChange
									: tradeType === "sell" && needsApproval
										? handleApprove
										: handleTrade
						}
						disabled={
							isAuthenticated
								? walletPlatformMismatch
									? true
									: appChainId !== normalizedChainId
										? false
										: !amount ||
											parseFloat(amount) <= 0 ||
											exceedsBalance ||
											belowMinimum ||
											isLoading ||
											isConfirming ||
											isApproving ||
											isApproveConfirming
								: false
						}
						className={cn(
							"w-full h-12 text-base font-semibold transition-all duration-200",
							walletPlatformMismatch
								? "bg-amber-600/30 hover:bg-amber-600/40 text-amber-400/70 cursor-help"
								: tradeType === "buy"
									? "bg-linear-to-r from-green-500 to-emerald-500 hover:opacity-90 cursor-pointer"
									: tradeType === "sell" && needsApproval
										? "bg-red-600/30 hover:bg-red-600/40 text-red-400 cursor-pointer"
										: "bg-linear-to-r from-red-500 to-rose-500 hover:opacity-90 text-gray-100 cursor-pointer",
						)}
					>
						{!isAuthenticated ? (
							<>Connect Wallet to Trade</>
						) : walletPlatformMismatch ? (
							<>
								<AlertTriangle className="h-5 w-5 mr-2" />
								Switch to {isSolana ? "Solana" : "EVM"} Wallet
							</>
						) : appChainId !== normalizedChainId ? (
							<>Switch To {nativeSymbol}</>
						) : tradeType === "sell" && needsApproval ? (
							exceedsBalance ? (
								<span className="flex items-center justify-center w-full truncate text-xs sm:text-sm">
									<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 shrink-0" />
									<span className="truncate">
										{balanceErrorMessage}
									</span>
								</span>
							) : // Approval state for sell
							isApproving || isApproveConfirming ? (
								<>
									<Loader2 className="h-5 w-5 mr-2 animate-spin" />
									Approving...
								</>
							) : (
								<>Approve {tokenSymbol}</>
							)
						) : isLoading ? (
							<>
								<Loader2 className="h-5 w-5 mr-2 animate-spin" />
								Confirm in Wallet...
							</>
						) : isConfirming ? (
							<>
								<Loader2 className="h-5 w-5 mr-2 animate-spin" />
								Confirming...
							</>
						) : isConfirmed && txHash ? (
							<>
								<CheckCircle2 className="h-5 w-5 mr-2 text-white" />
								Transaction Confirmed!
							</>
						) : isFailed && txHash ? (
							<>
								<XCircle className="h-5 w-5 mr-2 text-white" />
								Transaction Failed
							</>
						) : belowMinimum ? (
							<>
								<AlertTriangle className="h-5 w-5 mr-2" />
								Amount Too Small
							</>
						) : (
							<>
								{tradeType === "buy" ? (
									<TrendingUp className="h-5 w-5 mr-2" />
								) : (
									<TrendingDown className="h-5 w-5 mr-2" />
								)}
								{tradeType === "buy" ? "Buy" : "Sell"}{" "}
								{tokenSymbol}
							</>
						)}
					</Button>
				</>

				{/* Wallet Platform Mismatch Warning */}
				<AnimatePresence>
					{walletPlatformMismatch && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="mt-3 p-3 rounded-lg border border-amber-400/30 bg-amber-500/10"
						>
							<div className="flex items-start gap-2">
								<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
								<div className="flex flex-col gap-1">
									<span className="text-sm font-medium text-amber-300">
										Wallet Platform Mismatch
									</span>
									<span className="text-xs text-amber-200/70">
										This token is on{" "}
										{isSolana ? "Solana" : "EVM"}{" "}
										blockchain, but you have connected a{" "}
										{connectedWalletIsSolana
											? "Solana"
											: "EVM"}{" "}
										wallet. Please connect a{" "}
										{isSolana ? "Solana" : "EVM"} wallet to
										trade this token.
									</span>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Transaction Link */}
				<AnimatePresence>
					{txHash && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className={cn(
								"mt-4 p-3 rounded-lg border",
								isFailed
									? "bg-destructive/10 border-destructive/30"
									: isConfirmed
										? "bg-green-500/10 border-green-500/30"
										: "bg-primary/10 border-primary/30",
							)}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{isFailed ? (
										<XCircle className="h-5 w-5 text-destructive" />
									) : isConfirmed ? (
										<CheckCircle2 className="h-5 w-5 text-green-500" />
									) : isConfirming ? (
										<Loader2 className="h-5 w-5 text-primary animate-spin" />
									) : (
										<CheckCircle2 className="h-5 w-5 text-primary" />
									)}
									<span
										className={cn(
											"text-sm font-medium",
											isFailed && "text-destructive",
											isConfirmed && "text-green-500",
										)}
									>
										{isFailed
											? "Transaction Failed"
											: isConfirmed
												? "Transaction Confirmed"
												: isConfirming
													? "Confirming..."
													: "Transaction Submitted"}
									</span>
								</div>
								<a
									href={getTxUrl(txHash, normalizedChainId)}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline flex items-center gap-1 text-sm"
								>
									View <ExternalLink className="h-3 w-3" />
								</a>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Error Message */}
				<AnimatePresence>
					{error && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30"
						>
							<div className="flex items-center gap-2">
								<AlertTriangle className="h-5 w-5 text-destructive" />
								<span className="text-sm text-destructive">
									{error.message.slice(0, 100)}
								</span>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
