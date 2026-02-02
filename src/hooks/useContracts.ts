/**
 * Contract Interaction Hooks
 *
 * React hooks for interacting with HypeMint smart contracts using Wagmi
 */

import { useCallback, useEffect, useState } from "react";
import {
	useWriteContract,
	useReadContract,
	useWaitForTransactionReceipt,
	useBalance,
	usePublicClient,
	useSwitchChain,
} from "wagmi";
import { parseEther, type Address, type Hash } from "viem";
import {
	HYPE_FACTORY_ABI,
	HYPE_BONDING_CURVE_ABI,
	HYPE_TOKEN_ABI,
	getContractAddress,
	DEFAULT_CREATION_FEE,
	DEFAULT_SLIPPAGE_BPS,
} from "@/lib/contracts";
import { ACTIVE_CHAIN_ID } from "@/lib/contracts/config";
import { useChainId as useNetworkChainId } from "@/lib/network";
import { useAuth } from "./useAuth";

// Types
export interface CreateTokenParams {
	name: string;
	symbol: string;
	imageURI: string;
	description: string;
	hypeBoostEnabled: boolean;
	slope?: bigint;
	basePrice?: bigint;
}

export interface CreateTokenResult {
	tokenAddress: Address;
	bondingCurveAddress: Address;
	txHash: Hash;
}

export interface BuyParams {
	bondingCurveAddress: Address;
	maticAmount: string; // in MATIC (not wei)
	slippageBps?: number;
}

export interface SellParams {
	bondingCurveAddress: Address;
	tokenAddress: Address;
	tokenAmount: string; // in tokens (not wei)
	minMatic?: string; // minimum MATIC to receive (calculated from quote with slippage)
	slippageBps?: number;
}

// Hook: Get user's native balance for the current network
// Updates automatically when the user switches networks
export function useNativeBalance() {
	const { walletAddress } = useAuth();
	const networkChainId = useNetworkChainId();

	// for debugging
	useEffect(
		() => console.log("[useNativeBalance] networkChainId:", networkChainId),
		[networkChainId],
	);
	// Use the network store's chain ID, falling back to ACTIVE_CHAIN_ID
	const chainId = networkChainId ?? ACTIVE_CHAIN_ID;

	return useBalance({
		address: walletAddress,
		chainId,
	});
}

/**
 * Hook: Get factory creation fee
 */
export function useCreationFee() {
	const factoryAddress = getContractAddress("factory");

	return useReadContract({
		address: factoryAddress,
		abi: HYPE_FACTORY_ABI,
		functionName: "creationFee",
		chainId: ACTIVE_CHAIN_ID,
	});
}

// TokenCreated event topic (keccak256 hash of event signature)
const TOKEN_CREATED_TOPIC =
	"0x4836be210e0cef1e63931ae5137b536c1191d9dc411069cf651c05c584c6fcae";

// Hook: Create a new token
export function useCreateToken() {
	const { walletAddress: address } = useAuth();
	const chainId = useNetworkChainId();
	const publicClient = usePublicClient();
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const { switchChainAsync } = useSwitchChain();

	const { writeContractAsync } = useWriteContract();

	const { data: creationFee } = useCreationFee();

	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({
			hash: txHash,
		});

	const createToken = useCallback(
		async (
			params: CreateTokenParams,
		): Promise<CreateTokenResult | null> => {
			if (!address) {
				setError(new Error("Wallet not connected"));
				return null;
			}

			setIsCreating(true);
			setError(null);

			try {
				// Ensure we're on the correct chain
				if (chainId !== ACTIVE_CHAIN_ID) {
					console.log(
						`Switching from chain ${chainId} to ${ACTIVE_CHAIN_ID}`,
					);
					try {
						await switchChainAsync({ chainId: ACTIVE_CHAIN_ID });
					} catch (switchError) {
						console.error("Failed to switch chain:", switchError);
						setError(
							new Error(
								`Please switch to Polygon Amoy network (Chain ID: ${ACTIVE_CHAIN_ID})`,
							),
						);
						return null;
					}
				}

				const factoryAddress = getContractAddress("factory");
				const fee = creationFee || DEFAULT_CREATION_FEE;

				console.log("Creating token with params:", {
					factoryAddress,
					fee: fee.toString(),
					params,
					chainId: ACTIVE_CHAIN_ID,
				});

				// Write the transaction with proper gas settings for Polygon Amoy
				const hash = await writeContractAsync({
					address: factoryAddress,
					abi: HYPE_FACTORY_ABI,
					functionName: "createToken",
					args: [
						params.name,
						params.symbol,
						params.imageURI,
						params.description,
						params.hypeBoostEnabled,
						params.slope || BigInt(0),
						params.basePrice || BigInt(0),
					],
					value: fee,
					chainId: ACTIVE_CHAIN_ID,
					// Set higher gas price for Polygon Amoy testnet (minimum 25 gwei)
					maxFeePerGas: BigInt(50000000000), // 50 gwei
					maxPriorityFeePerGas: BigInt(30000000000), // 30 gwei
				});

				console.log("Transaction submitted:", hash);
				setTxHash(hash);

				// Set isCreating to false immediately after transaction submission
				// The isConfirming state from useWaitForTransactionReceipt will handle the waiting period
				setIsCreating(false);

				// Wait for receipt and get the created token addresses
				if (publicClient) {
					const receipt =
						await publicClient.waitForTransactionReceipt({
							hash,
							confirmations: 1,
						});

					console.log("Transaction confirmed:", receipt);

					// Find the TokenCreated event from factory contract
					const factoryLower = factoryAddress.toLowerCase();
					const tokenCreatedLog = receipt.logs.find((log) => {
						return (
							log.address.toLowerCase() === factoryLower &&
							log.topics[0] === TOKEN_CREATED_TOPIC
						);
					});

					if (tokenCreatedLog && tokenCreatedLog.topics.length >= 4) {
						// topics[1] = tokenAddress (indexed)
						// topics[2] = bondingCurveAddress (indexed)
						// topics[3] = creator (indexed)
						const tokenAddress = ("0x" +
							tokenCreatedLog.topics[1]?.slice(26)) as Address;
						const bondingCurveAddress = ("0x" +
							tokenCreatedLog.topics[2]?.slice(26)) as Address;

						console.log("Token created:", {
							tokenAddress,
							bondingCurveAddress,
						});

						return {
							tokenAddress,
							bondingCurveAddress,
							txHash: hash,
						};
					}

					// Fallback: try to find any log with indexed addresses
					for (const log of receipt.logs) {
						if (
							log.topics.length >= 3 &&
							log.address.toLowerCase() === factoryLower
						) {
							const tokenAddress = ("0x" +
								log.topics[1]?.slice(26)) as Address;
							const bondingCurveAddress = ("0x" +
								log.topics[2]?.slice(26)) as Address;

							if (
								tokenAddress !==
								"0x0000000000000000000000000000000000000000"
							) {
								return {
									tokenAddress,
									bondingCurveAddress,
									txHash: hash,
								};
							}
						}
					}
				}

				// If we can't parse logs, still return success with tx hash
				return {
					tokenAddress: "0x0" as Address,
					bondingCurveAddress: "0x0" as Address,
					txHash: hash,
				};
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: any) {
				// -
				//
				console.error("Failed to create token:", err);

				// Parse better error messages--
				let errorMessage = "Failed to create token";
				if (err?.message?.includes("User rejected")) {
					errorMessage = "Transaction was rejected by user";
				} else if (err?.message?.includes("insufficient funds")) {
					errorMessage = "Insufficient funds for transaction";
				} else if (err?.message?.includes("InsufficientCreationFee")) {
					errorMessage =
						"Insufficient creation fee. Please send at least 0.01 POL";
				} else if (err?.shortMessage) {
					errorMessage = err.shortMessage;
				} else if (err?.message) {
					errorMessage = err.message;
				}

				setError(new Error(errorMessage));
				// Reset isCreating if it's still true (in case of early error before tx submission)
				setIsCreating(false);
				return null;
			}
		},
		[
			address,
			chainId,
			writeContractAsync,
			creationFee,
			publicClient,
			switchChainAsync,
		],
	);

	return {
		createToken,
		isCreating,
		isConfirming,
		isConfirmed,
		txHash,
		error,
		reset: () => {
			setTxHash(undefined);
			setError(null);
		},
	};
}

// Hook: Get bonding curve state
export function useBondingCurveState(bondingCurveAddress: Address | undefined) {
	const { data: currentPrice } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getCurrentPrice",
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: marketCap } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getMarketCap",
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: totalSupply } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "totalSupply",
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: reserveBalance } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "reserveBalance",
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: isGraduated } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "isGraduated",
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	return {
		currentPrice: currentPrice as bigint | undefined,
		marketCap: marketCap as bigint | undefined,
		totalSupply: totalSupply as bigint | undefined,
		reserveBalance: reserveBalance as bigint | undefined,
		isGraduated: isGraduated as boolean | undefined,
	};
}

// Hook: Calculate buy quote
export function useBuyQuote(
	bondingCurveAddress: Address | undefined,
	maticAmount: string,
) {
	const amountWei = maticAmount ? parseEther(maticAmount) : BigInt(0);

	return useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "calculateBuy",
		args: [amountWei],
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress && amountWei > BigInt(0),
		},
	});
}

// Hook: Calculate sell quote
export function useSellQuote(
	bondingCurveAddress: Address | undefined,
	tokenAmount: string,
) {
	const amountWei = tokenAmount ? parseEther(tokenAmount) : BigInt(0);

	return useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "calculateSell",
		args: [amountWei],
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress && amountWei > BigInt(0),
		},
	});
}

// Hook: Buy tokens
export function useBuyTokens() {
	const { walletAddress: address } = useAuth();
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isBuying, setIsBuying] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const { writeContractAsync } = useWriteContract();

	const {
		isLoading: isConfirming,
		isSuccess: isConfirmed,
		isError: isConfirmError,
		data: receipt,
	} = useWaitForTransactionReceipt({
		hash: txHash,
	});

	// Transaction was reverted on-chain
	const isFailed = isConfirmError || receipt?.status === "reverted";

	const buy = useCallback(
		async (params: BuyParams): Promise<Hash | null> => {
			if (!address) {
				setError(new Error("Wallet not connected"));
				return null;
			}

			setIsBuying(true);
			setError(null);

			try {
				const maticWei = parseEther(params.maticAmount);
				const slippage = params.slippageBps || DEFAULT_SLIPPAGE_BPS;

				// For simplicity, set minTokens to 0 (could calculate properly with quote)
				const minTokens = BigInt(0);

				// Debug logging
				console.log("[useBuyTokens] Buy params:", {
					bondingCurveAddress: params.bondingCurveAddress,
					maticAmount: params.maticAmount,
					maticWei: maticWei.toString(),
					minTokens: minTokens.toString(),
					slippageBps: slippage,
					chainId: ACTIVE_CHAIN_ID,
				});

				const hash = await writeContractAsync({
					address: params.bondingCurveAddress,
					abi: HYPE_BONDING_CURVE_ABI,
					functionName: "buy",
					args: [minTokens],
					value: maticWei,
					chainId: ACTIVE_CHAIN_ID,
					// Set higher gas price for Polygon Amoy testnet (minimum 25 gwei)
					maxFeePerGas: BigInt(50000000000), // 50 gwei
					maxPriorityFeePerGas: BigInt(30000000000), // 30 gwei
				});

				console.log("[useBuyTokens] Transaction hash:", hash);
				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to buy tokens:", err);
				setError(
					err instanceof Error
						? err
						: new Error("Failed to buy tokens"),
				);
				return null;
			} finally {
				setIsBuying(false);
			}
		},
		[address, writeContractAsync],
	);

	return {
		buy,
		isBuying,
		isConfirming,
		isConfirmed,
		isFailed,
		txHash,
		error,
		reset: () => {
			setTxHash(undefined);
			setError(null);
		},
	};
}

// Hook: Sell tokens
export function useSellTokens() {
	const { walletAddress: address } = useAuth();
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isSelling, setIsSelling] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const { writeContractAsync } = useWriteContract();

	const {
		isLoading: isConfirming,
		isSuccess: isConfirmed,
		isError: isConfirmError,
		data: receipt,
	} = useWaitForTransactionReceipt({
		hash: txHash,
	});

	// Transaction was reverted on-chain
	const isFailed = isConfirmError || receipt?.status === "reverted";

	const sell = useCallback(
		async (params: SellParams): Promise<Hash | null> => {
			if (!address) {
				setError(new Error("Wallet not connected"));
				return null;
			}

			setIsSelling(true);
			setError(null);

			try {
				const tokenWei = parseEther(params.tokenAmount);
				// Use provided minMatic (with slippage already applied) or 0 for no slippage protection
				const minMatic = params.minMatic
					? parseEther(params.minMatic)
					: BigInt(0);

				console.log("[useSellTokens] Sell params:", {
					bondingCurveAddress: params.bondingCurveAddress,
					tokenAmount: params.tokenAmount,
					tokenWei: tokenWei.toString(),
					minMatic: minMatic.toString(),
					chainId: ACTIVE_CHAIN_ID,
				});

				const hash = await writeContractAsync({
					address: params.bondingCurveAddress,
					abi: HYPE_BONDING_CURVE_ABI,
					functionName: "sell",
					args: [tokenWei, minMatic],
					chainId: ACTIVE_CHAIN_ID,
					// Set higher gas price for Polygon Amoy testnet (minimum 25 gwei)
					maxFeePerGas: BigInt(50000000000), // 50 gwei
					maxPriorityFeePerGas: BigInt(30000000000), // 30 gwei
				});

				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to sell tokens:", err);
				setError(
					err instanceof Error
						? err
						: new Error("Failed to sell tokens"),
				);
				return null;
			} finally {
				setIsSelling(false);
			}
		},
		[address, writeContractAsync],
	);

	return {
		sell,
		isSelling,
		isConfirming,
		isConfirmed,
		isFailed,
		txHash,
		error,
		reset: () => {
			setTxHash(undefined);
			setError(null);
		},
	};
}

// Hook: Get token balance
export function useTokenBalance(
	tokenAddress: Address | undefined,
	userAddress?: Address,
) {
	const { walletAddress: connectedAddress } = useAuth();
	const targetAddress = userAddress || connectedAddress;

	return useReadContract({
		address: tokenAddress,
		abi: HYPE_TOKEN_ABI,
		functionName: "balanceOf",
		args: targetAddress ? [targetAddress] : undefined,
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!tokenAddress && !!targetAddress,
		},
	});
}

// Hook: Approve token spending
export function useApproveToken() {
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isApproving, setIsApproving] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const { writeContractAsync } = useWriteContract();

	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({
			hash: txHash,
		});

	const approve = useCallback(
		async (
			tokenAddress: Address,
			spenderAddress: Address,
			amount: bigint,
		): Promise<Hash | null> => {
			setIsApproving(true);
			setError(null);

			try {
				const hash = await writeContractAsync({
					address: tokenAddress,
					abi: HYPE_TOKEN_ABI,
					functionName: "approve",
					args: [spenderAddress, amount],
					chainId: ACTIVE_CHAIN_ID,
					// Set higher gas price for Polygon Amoy testnet (minimum 25 gwei)
					maxFeePerGas: BigInt(50000000000), // 50 gwei
					maxPriorityFeePerGas: BigInt(30000000000), // 30 gwei
				});

				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to approve token:", err);
				setError(
					err instanceof Error ? err : new Error("Failed to approve"),
				);
				return null;
			} finally {
				setIsApproving(false);
			}
		},
		[writeContractAsync],
	);

	return {
		approve,
		isApproving,
		isConfirming,
		isConfirmed,
		txHash,
		error,
		reset: () => {
			setTxHash(undefined);
			setError(null);
		},
	};
}

// Hook: Check token allowance
export function useTokenAllowance(
	tokenAddress: Address | undefined,
	spenderAddress: Address | undefined,
) {
	const { walletAddress: ownerAddress } = useAuth();

	return useReadContract({
		address: tokenAddress,
		abi: HYPE_TOKEN_ABI,
		functionName: "allowance",
		args:
			ownerAddress && spenderAddress
				? [ownerAddress, spenderAddress]
				: undefined,
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
		},
	});
}

// Hook: Get vesting info
export function useVestingInfo(bondingCurveAddress: Address | undefined) {
	const { walletAddress } = useAuth();

	const { data: vestingInfo, refetch: refetchVestingInfo } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getVestingInfo",
		args: walletAddress ? [walletAddress] : undefined,
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress && !!walletAddress,
		},
	});

    const { data: claimableAmount, refetch: refetchClaimable } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getClaimableVested",
		args: walletAddress ? [walletAddress] : undefined,
		chainId: ACTIVE_CHAIN_ID,
		query: {
			enabled: !!bondingCurveAddress && !!walletAddress,
		},
	});

	const refetch = useCallback(async () => {
		await Promise.all([refetchVestingInfo(), refetchClaimable()]);
	}, [refetchVestingInfo, refetchClaimable]);

    return {
        vestingInfo: vestingInfo as {
            totalAmount: bigint;
            claimedAmount: bigint;
            startTime: bigint;
        } | undefined,
        claimableAmount: claimableAmount as bigint | undefined,
		refetch,
    };
}

// Hook: Claim vested tokens
export function useClaimVested() {
	const { walletAddress: address } = useAuth();
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isClaiming, setIsClaiming] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const { writeContractAsync } = useWriteContract();

	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({
			hash: txHash,
		});

	const claim = useCallback(
		async (bondingCurveAddress: Address): Promise<Hash | null> => {
			if (!address) {
				setError(new Error("Wallet not connected"));
				return null;
			}

			setIsClaiming(true);
			setError(null);

			try {
				const hash = await writeContractAsync({
					address: bondingCurveAddress,
					abi: HYPE_BONDING_CURVE_ABI,
					functionName: "claimVested",
					chainId: ACTIVE_CHAIN_ID,
                    // Set higher gas price for Polygon Amoy testnet
					maxFeePerGas: BigInt(50000000000), // 50 gwei
					maxPriorityFeePerGas: BigInt(30000000000), // 30 gwei
				});

				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to claim tokens:", err);
				setError(
					err instanceof Error
						? err
						: new Error("Failed to claim tokens"),
				);
				return null;
			} finally {
				setIsClaiming(false);
			}
		},
		[address, writeContractAsync],
	);

	return {
		claim,
		isClaiming,
		isConfirming,
		isConfirmed,
		txHash,
		error,
		reset: () => {
			setTxHash(undefined);
			setError(null);
		},
	};
}
