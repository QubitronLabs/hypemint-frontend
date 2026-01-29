"use client";

/**
 * On-Chain Trading Panel Component
 * Real blockchain trading interface using Wagmi/Viem
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther, parseEther, type Address } from "viem";
import {
	ArrowUpCircle,
	ArrowDownCircle,
	Wallet,
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
import { cn } from "@/lib/utils";
import {
	useBuyTokens,
	useSellTokens,
	useBuyQuote,
	useSellQuote,
	useTokenBalance,
	useNativeBalance,
	useApproveToken,
	useTokenAllowance,
	useAuth,
	useNativeCurrencySymbol,
} from "@/hooks";
import { getTxUrl } from "@/lib/wagmi";
import { recordOnChainTrade } from "@/lib/api/trades";
import { toast } from "sonner";

// Note: Trade recording is now handled by backend blockchain event listener
// Frontend only needs to display confirmation UI

interface OnChainTradingPanelProps {
	tokenAddress: Address;
	bondingCurveAddress: Address;
	tokenSymbol: string;
	tokenName: string;
	currentPrice: string;
	className?: string;
}

type TradeType = "buy" | "sell";

// Format number with commas - handles extremely large numbers
function formatNumber(num: number | string): string {
	const n = typeof num === "string" ? parseFloat(num) : num;
	if (isNaN(n) || !isFinite(n)) return "0";
	if (n >= 1e15) return (n / 1e15).toFixed(2) + "Q"; // Quadrillion
	if (n >= 1e12) return (n / 1e12).toFixed(2) + "T"; // Trillion
	if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
	if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
	if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
	if (n < 0.00000001 && n > 0) return "<0.00000001";
	if (n < 0.0001 && n > 0) return n.toExponential(2);
	return n.toFixed(n < 1 ? 8 : 4);
}

// Format price with better precision for small values
function formatPriceDisplay(num: number, symbol: string = "POL"): string {
	if (isNaN(num) || !isFinite(num)) return "0";
	if (num >= 1e9) return `>999M`;
	if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
	if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
	if (num >= 1) return num.toFixed(4);
	if (num >= 0.0001) return num.toFixed(6);
	if (num >= 0.00000001) return num.toFixed(10);
	if (num > 0) return num.toExponential(4);
	return "0";
}

// Validate trade amount is reasonable
function validateTradeAmount(
	amount: string,
	isBuy: boolean,
	balance: bigint | undefined,
): { valid: boolean; error?: string } {
	const parsed = parseFloat(amount);
	if (isNaN(parsed) || parsed <= 0)
		return { valid: false, error: "Enter a valid amount" };
	if (!isFinite(parsed)) return { valid: false, error: "Amount too large" };

	// Check if amount would result in astronomical values (likely calculation error)
	if (isBuy && parsed > 1000000)
		return { valid: false, error: "Amount exceeds reasonable limit" };

	return { valid: true };
}

export function OnChainTradingPanel({
	tokenAddress,
	bondingCurveAddress,
	tokenSymbol,
	tokenName,
	currentPrice,
	className,
}: OnChainTradingPanelProps) {
	const {
		walletAddress: address,
		isAuthenticated,
		setShowAuthFlow,
	} = useAuth();
	const [tradeType, setTradeType] = useState<TradeType>("buy");
	const [amount, setAmount] = useState("");
	const [slippage, setSlippage] = useState(5); // 5% default

	// Get dynamic native currency symbol
	const nativeSymbol = useNativeCurrencySymbol();

	// Balances - with refetch capability
	const { data: nativeBalance, refetch: refetchNativeBalance } =
		useNativeBalance();
	const {
		data: tokenBalance,
		refetch: refetchTokenBalance,
		isLoading: isLoadingBalance,
	} = useTokenBalance(tokenAddress);

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
		bondingCurveAddress,
		tradeType === "buy" ? amount : "",
	);
	const { data: sellQuote, isLoading: isSellQuoteLoading } = useSellQuote(
		bondingCurveAddress,
		tradeType === "sell" ? amount : "",
	);

	// Allowance check for selling
	const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
		tokenAddress,
		bondingCurveAddress,
	);

	// Trade hooks
	const {
		buy,
		isBuying,
		isConfirming: isBuyConfirming,
		isConfirmed: isBuyConfirmed,
		isFailed: isBuyFailed,
		txHash: buyTxHash,
		error: buyError,
		reset: resetBuy,
	} = useBuyTokens();

	const {
		sell,
		isSelling,
		isConfirming: isSellConfirming,
		isConfirmed: isSellConfirmed,
		isFailed: isSellFailed,
		txHash: sellTxHash,
		error: sellError,
		reset: resetSell,
	} = useSellTokens();

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


	// Check if needs approval for sell
	const needsApproval = useMemo(() => {
		if (tradeType !== "sell" || !amount) return false;
		try {
			const amountWei = parseEther(amount);
			return allowance !== undefined && allowance < amountWei;
		} catch {
			return false;
		}
	}, [tradeType, amount, allowance]);

	// Calculate trade metrics with safety checks
	const tradeMetrics = useMemo(() => {
		const parsedAmount = parseFloat(amount) || 0;
		const price = parseFloat(currentPrice) || 0.00001;

		if (tradeType === "buy" && buyQuote) {
			const [tokenAmount, protocolFee, creatorFee] = buyQuote as [
				bigint,
				bigint,
				bigint,
			];
			const tokensOut = parseFloat(formatEther(tokenAmount));
			const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
			const effectivePrice = tokensOut > 0 ? parsedAmount / tokensOut : 0;
			const priceImpact =
				price > 0 ? ((effectivePrice - price) / price) * 100 : 0;

			// Safety check for unreasonable values
			const isUnreasonable =
				!isFinite(tokensOut) ||
				tokensOut > 1e18 ||
				!isFinite(effectivePrice);

			return {
				outputAmount: isUnreasonable ? 0 : tokensOut,
				fees: isFinite(totalFees) ? totalFees : 0,
				effectivePrice: isUnreasonable ? 0 : effectivePrice,
				priceImpact: isFinite(priceImpact) ? Math.abs(priceImpact) : 0,
				isHighImpact: Math.abs(priceImpact) > 5,
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
			const totalFees = parseFloat(formatEther(protocolFee + creatorFee));
			const effectivePrice =
				parsedAmount > 0 ? maticOut / parsedAmount : 0;
			const priceImpact =
				price > 0 ? ((price - effectivePrice) / price) * 100 : 0;

			// Safety check for unreasonable values (e.g., more than 1 billion MATIC)
			const isUnreasonable =
				!isFinite(maticOut) ||
				maticOut > 1e9 ||
				!isFinite(effectivePrice);

			return {
				outputAmount: isUnreasonable ? 0 : maticOut,
				fees: isFinite(totalFees) ? totalFees : 0,
				effectivePrice: isUnreasonable ? 0 : effectivePrice,
				priceImpact: isFinite(priceImpact) ? Math.abs(priceImpact) : 0,
				isHighImpact: Math.abs(priceImpact) > 5,
				isUnreasonable,
			};
		}

		return {
			outputAmount: 0,
			fees: 0,
			effectivePrice: price,
			priceImpact: 0,
			isHighImpact: false,
			isUnreasonable: false,
		};
	}, [amount, tradeType, currentPrice, buyQuote, sellQuote]);

	// Sync confirmed trades to backend (verified on-chain before recording)
	const syncTradeToBackend = useCallback(
		async (hash: string, type: "buy" | "sell") => {
			try {
				// Backend verifies the transaction on-chain before recording
				await recordOnChainTrade({
					tokenId: tokenAddress,
					bondingCurveAddress,
					type,
					maticAmount: "0", // Will be extracted from blockchain
					tokenAmount: "0", // Will be extracted from blockchain
					txHash: hash,
				});
				// console.log("[OnChainTrading] Trade synced to backend:", hash);
			} catch (err) {
				console.error(
					"[OnChainTrading] Failed to sync trade to backend:",
					err,
				);
				// Don't show error to user - on-chain trade succeeded, backend sync is secondary
			}
		},
		[tokenAddress, bondingCurveAddress],
	);

	// Refetch balances and sync when trades are confirmed
	// Note: Backend event listener also records the trade independently
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
					onClick: () => window.open(getTxUrl(buyTxHash), "_blank"),
				},
			});
			syncTradeToBackend(buyTxHash, "buy");
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
		syncTradeToBackend,
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
					onClick: () => window.open(getTxUrl(buyTxHash), "_blank"),
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
					onClick: () => window.open(getTxUrl(sellTxHash), "_blank"),
				},
			});
			syncTradeToBackend(sellTxHash, "sell");
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
		syncTradeToBackend,
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
					onClick: () => window.open(getTxUrl(sellTxHash), "_blank"),
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
			setTimeout(() => {
				refetchAllowance();
			}, 2000); // Wait 2s for blockchain state to update
			toast.success("Approval confirmed! You can now sell tokens.");
			resetApprove();
		}
	}, [isApproveConfirmed, refetchAllowance, resetApprove]);

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
			toast.success("Approval successful!");
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

		resetBuy();
		resetSell();

		try {
			if (tradeType === "buy") {
				toast.info("Confirm transaction in wallet...", { id: "trade" });
				const hash = await buy({
					bondingCurveAddress,
					maticAmount: amount,
					slippageBps: slippage * 100,
				});
				if (hash) {
					toast.success("Buy order submitted!", {
						id: "trade",
						description: `Tx: ${hash.slice(0, 10)}...`,
						action: {
							label: "View",
							onClick: () =>
								window.open(getTxUrl(hash), "_blank"),
						},
					});
				}
			} else {
				// Check approval first
				if (needsApproval) {
					toast.error("Please approve tokens first");
					return;
				}

				toast.info("Confirm transaction in wallet...", { id: "trade" });

				// Calculate minMatic from sellQuote with slippage
				let minMaticStr = "0";
				if (sellQuote) {
					const [maticAmount] = sellQuote as [bigint, bigint, bigint];
					// Apply slippage: minMatic = expectedMatic * (1 - slippage%)
					const slippageMultiplier = BigInt(10000 - slippage * 100);
					const minMaticWei =
						(maticAmount * slippageMultiplier) / BigInt(10000);
					minMaticStr = formatEther(minMaticWei);
					console.log("[OnChainTrading] Sell with minMatic:", {
						expectedMatic: formatEther(maticAmount),
						slippage: slippage + "%",
						minMatic: minMaticStr,
					});
				}

				const hash = await sell({
					bondingCurveAddress,
					tokenAddress,
					tokenAmount: amount,
					minMatic: minMaticStr,
					slippageBps: slippage * 100,
				});
				if (hash) {
					toast.success("Sell order submitted!", {
						id: "trade",
						description: `Tx: ${hash.slice(0, 10)}...`,
						action: {
							label: "View",
							onClick: () =>
								window.open(getTxUrl(hash), "_blank"),
						},
					});
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
			? ["0.1", "0.5", "1", "5"] // MATIC amounts
			: ["25%", "50%", "75%", "MAX"]; // Percentage of balance

	const handleQuickAmount = (qa: string) => {
		if (tradeType === "buy") {
			setAmount(qa);
		} else {
			// Calculate percentage of token balance
			if (!tokenBalance) return;
			const balance = parseFloat(formatEther(tokenBalance as bigint));
			let percentage = 1;
			if (qa === "25%") percentage = 0.25;
			else if (qa === "50%") percentage = 0.5;
			else if (qa === "75%") percentage = 0.75;

			// else if (qa === "MAX") 0.99
			else if (qa === "MAX") percentage = 0.9999999;

			setAmount((balance * percentage).toFixed(6));
		}
	};

	// Reset on trade type change
	useEffect(() => {
		setAmount("");
		resetBuy();
		resetSell();
		resetApprove();
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
								? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
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
								? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20"
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
								? `${nativeBalance?.value ? formatNumber(formatEther(nativeBalance.value)) : "0"} ${nativeSymbol}`
								: `${tokenBalance ? formatNumber(formatEther(tokenBalance as bigint)) : "0"} ${tokenSymbol}`}
						</span>
					</div>
					<div className="relative">
						<Input
							type="number"
							placeholder="0.00"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="pr-14 sm:pr-16 text-base sm:text-lg font-medium bg-background/50"
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
							className="flex-1 py-1.5 text-xs font-medium bg-background/50 border border-border/50 rounded-md hover:border-primary/30 transition-colors"
						>
							{qa}
						</button>
					))}
				</div>

				{/* Output Estimate */}
				<AnimatePresence mode="wait">
					{parseFloat(amount) > 0 && (
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
										isSellQuoteLoading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : tradeMetrics.isUnreasonable ? (
											<span className="text-destructive">
												--
											</span>
										) : (
											<>
												{formatNumber(
													tradeMetrics.outputAmount,
												)}{" "}
												{tradeType === "buy"
													? tokenSymbol
													: nativeSymbol}
											</>
										)}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">
										Price per Token
									</span>
									<span className="font-medium">
										{tradeMetrics.isUnreasonable
											? "--"
											: formatPriceDisplay(
													tradeMetrics.effectivePrice,
													nativeSymbol,
												)}{" "}
										{nativeSymbol}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">
										Fees (2%)
									</span>
									<span className="font-medium">
										{tradeMetrics.isUnreasonable
											? "--"
											: formatNumber(
													tradeMetrics.fees,
												)}{" "}
										{nativeSymbol}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">
										Price Impact
									</span>
									<span
										className={cn(
											"font-medium",
											tradeMetrics.isHighImpact
												? "text-destructive"
												: "text-muted-foreground",
										)}
									>
										{tradeMetrics.isUnreasonable
											? "--"
											: `${tradeMetrics.priceImpact.toFixed(2)}%`}
										{tradeMetrics.isHighImpact &&
											!tradeMetrics.isUnreasonable && (
												<AlertTriangle className="h-3 w-3 inline ml-1" />
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
										? "bg-primary text-primary-foreground"
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
					{/* Approval Button (for sell) */}
					{tradeType === "sell" && needsApproval && (
						<Button
							onClick={handleApprove}
							disabled={isApproving || isApproveConfirming}
							className="w-full h-12 mb-2 bg-gradient-to-r from-purple-500 to-pink-500"
						>
							{isApproving || isApproveConfirming ? (
								<>
									<Loader2 className="h-5 w-5 mr-2 animate-spin" />
									Approving...
								</>
							) : (
								<>
									<Zap className="h-5 w-5 mr-2" />
									Approve {tokenSymbol}
								</>
							)}
						</Button>
					)}

					{/* Trade Button */}
					<Button
						onClick={handleTrade}
						disabled={
							isAuthenticated
								? !amount ||
									parseFloat(amount) <= 0 ||
									isLoading ||
									isConfirming ||
									(tradeType === "sell" && needsApproval)
								: false
						}
						className={cn(
							"w-full h-12 text-base font-semibold cursor-pointer transition-all duration-200",
							tradeType === "buy"
								? "bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
								: "bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-90 text-gray-100",
						)}
					>
						{!isAuthenticated ? (
							<>Connect Wallet to Trade</>
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
									href={getTxUrl(txHash)}
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
