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
	useChainId as useWagmiChainId,
	useAccount as useWagmiAccount,
} from "wagmi";
import { parseEther, parseGwei, type Address, type Hash } from "viem";
import {
	HYPE_FACTORY_ABI,
	HYPE_BONDING_CURVE_ABI,
	HYPE_TOKEN_ABI,
	getContractAddress,
	DEFAULT_CREATION_FEE,
	DEFAULT_SLIPPAGE_BPS,
} from "@/lib/contracts";
import { ACTIVE_CHAIN_ID } from "@/lib/contracts/config";
import { useContractConfigStore } from "./useContractConfig";
import { useChainId as useNetworkChainId } from "@/lib/network";
import { useAuth } from "./useAuth";

/**
 * Hook: Get the active EVM chain ID.
 *
 * Priority:
 *   1. The wallet's current chain, IF there is an active deployment for it.
 *   2. The first active EVM deployment in the store.
 *   3. ACTIVE_CHAIN_ID (hard-coded fallback).
 *
 * This ensures that when a user switches their wallet to Avalanche (43114),
 * we use the Avalanche deployment — not the first alphabetical EVM entry.
 */
export function useActiveEvmChainId(): number {
	const walletChainId = useWagmiChainId();
	const chainId = useContractConfigStore((s) => {
		if (s.isLoaded && s.deployments.length > 0) {
			// First: if the wallet's current chain has an active deployment, use it
			if (walletChainId) {
				const walletDeploy = s.deployments.find(
					(d) => d.chainId === walletChainId && d.chainType === "EVM" && d.isActive,
				);
				if (walletDeploy) return walletDeploy.chainId;
			}
			// Fallback: first active EVM deployment
			const evmDeploy = s.deployments.find(
				(d) => d.chainType === "EVM" && d.isActive,
			);
			if (evmDeploy) return evmDeploy.chainId;
		}
		return null;
	});
	return chainId ?? ACTIVE_CHAIN_ID;
}

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
	/** Override chain ID (defaults to active EVM chain from wallet) */
	chainId?: number;
}

export interface SellParams {
	bondingCurveAddress: Address;
	tokenAddress: Address;
	tokenAmount: string; // in tokens (not wei)
	minMatic?: string; // minimum MATIC to receive (calculated from quote with slippage)
	slippageBps?: number;
	/** Override chain ID (defaults to active EVM chain from wallet) */
	chainId?: number;
}

// Hook: Get user's native balance for the current network
// Updates automatically when the user switches networks
export function useNativeBalance() {
	const { walletAddress } = useAuth();
	const networkChainId = useNetworkChainId();
	const evmChainId = useActiveEvmChainId();

	// for debugging
	useEffect(
		() => console.log("[useNativeBalance] networkChainId:", networkChainId),
		[networkChainId],
	);
	// Use the network store's chain ID, falling back to backend-configured EVM chain
	const chainId = networkChainId ?? evmChainId;

	return useBalance({
		address: walletAddress,
		chainId,
	});
}

/**
 * Hook: Get factory creation fee
 */
export function useCreationFee() {
	const evmChainId = useActiveEvmChainId();
	const factoryAddress = getContractAddress("factory", evmChainId);

	return useReadContract({
		address: factoryAddress,
		abi: HYPE_FACTORY_ABI,
		functionName: "creationFee",
		chainId: evmChainId,
	});
}

// TokenCreated event topic (keccak256 hash of event signature)
const TOKEN_CREATED_TOPIC =
	"0x4836be210e0cef1e63931ae5137b536c1191d9dc411069cf651c05c584c6fcae";

// ============================================================================
// PENDING TRANSACTION UTILITIES
// ============================================================================

/**
 * Check how many transactions are pending (in-flight) for the given address.
 * Compares the "pending" nonce (next available nonce including mempool)
 * against the "latest" nonce (last mined nonce).
 *
 * Polygon RPCs enforce a per-account in-flight limit (often 16 or 64).
 * If we detect pending txs, we can warn the user or wait before sending more.
 */
async function getPendingTransactionCount(
	publicClient: ReturnType<typeof usePublicClient>,
	address: Address,
): Promise<number> {
	if (!publicClient) return 0;
	try {
		const [pendingCount, latestCount] = await Promise.all([
			publicClient.getTransactionCount({ address, blockTag: "pending" }),
			publicClient.getTransactionCount({ address, blockTag: "latest" }),
		]);
		return pendingCount - latestCount;
	} catch {
		// If the RPC doesn't support pending blockTag, assume 0
		return 0;
	}
}

/**
 * Wait for all pending transactions to clear before submitting a new one.
 * Polls every `intervalMs` until pending count reaches 0 or `timeoutMs` elapses.
 *
 * @returns true if pending transactions cleared, false if timed out
 */
async function waitForPendingTransactions(
	publicClient: ReturnType<typeof usePublicClient>,
	address: Address,
	timeoutMs = 30_000,
	intervalMs = 2_000,
): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const pending = await getPendingTransactionCount(publicClient, address);
		if (pending <= 0) return true;
		console.log(`[tx-queue] Waiting for ${pending} pending tx(s) to clear...`);
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	return false;
}

/**
 * Detect if an error is the Polygon "in-flight transaction limit" error
 */
function isInFlightLimitError(err: unknown): boolean {
	const msg =
		(err as any)?.message?.toLowerCase() ??
		(err as any)?.shortMessage?.toLowerCase() ??
		"";
	return (
		msg.includes("in-flight transaction limit") ||
		msg.includes("inflight transaction limit") ||
		msg.includes("delegated accounts") ||
		msg.includes("max_inflight_txs") ||
		msg.includes("replacement transaction underpriced") ||
		msg.includes("already known")
	);
}

// Hook: Create a new token
export function useCreateToken() {
	const { address } = useWagmiAccount();
	const walletChainId = useWagmiChainId(); // Actual wallet chain from Wagmi
	const evmChainId = useActiveEvmChainId(); // Dynamic from backend config
	const publicClient = usePublicClient();
	const [txHash, setTxHash] = useState<Hash | undefined>();
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<Error | null>(null);

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
				// Verify the wallet's current chain has an active deployment
				// Do NOT auto-switch to a random chain — that causes the BNB chain bug
				const store = useContractConfigStore.getState();
				const walletDeployment = store.deployments.find(
					(d) => d.chainId === walletChainId && d.chainType === "EVM" && d.isActive,
				);

				if (!walletDeployment) {
					// The wallet is on a chain we don't have a deployment for
					const supportedChains = store.deployments
						.filter((d) => d.chainType === "EVM" && d.isActive)
						.map((d) => `${d.chainName} (${d.chainId})`);
					setError(
						new Error(
							`No HypeMint deployment on this network. Please switch your wallet to a supported chain: ${supportedChains.join(", ")}`,
						),
					);
					setIsCreating(false);
					return null;
				}

				// Use the wallet's current chain for the transaction
				const targetChainId = walletChainId;

				const factoryAddress = getContractAddress(
					"factory",
					targetChainId,
				);
				const fee = creationFee || DEFAULT_CREATION_FEE;

				// ── Check for pending transactions before submitting ──
				// Polygon RPCs enforce an in-flight limit per account.
				// If there are stuck pending txs we wait for them to clear first.
				if (publicClient && address) {
					const pendingCount = await getPendingTransactionCount(publicClient, address);
					if (pendingCount > 0) {
						console.warn(
							`[createToken] ${pendingCount} pending transaction(s) detected — waiting for them to clear...`,
						);
						const cleared = await waitForPendingTransactions(
							publicClient,
							address,
							30_000,
							2_000,
						);
						if (!cleared) {
							setError(
								new Error(
									`You have ${pendingCount} pending transaction(s). Please wait for them to confirm or cancel them in your wallet before creating a new token.`,
								),
							);
							setIsCreating(false);
							return null;
						}
						console.log("[createToken] Pending transactions cleared, proceeding...");
					}
				}

				console.log("Creating token with params:", {
					factoryAddress,
					fee: fee.toString(),
					params,
					chainId: targetChainId,
				});

				// ── Submit transaction with retry logic for in-flight errors ──
				let hash: Hash | undefined;
				const maxRetries = 3;
				for (let attempt = 1; attempt <= maxRetries; attempt++) {
					try {
						// Get the explicit nonce from the RPC to avoid stale nonce issues
						let nonce: number | undefined;
						if (publicClient && address) {
							nonce = await publicClient.getTransactionCount({
								address,
								blockTag: "pending",
							});
						}

						// Polygon / Amoy RPCs need explicit gas params
						const isPolygonChain = [137, 80002].includes(targetChainId);
						const gasOverrides = isPolygonChain
							? { maxPriorityFeePerGas: parseGwei("30"), maxFeePerGas: parseGwei("150") }
							: {};

						hash = await writeContractAsync({
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
							chainId: targetChainId,
							nonce,
							...gasOverrides,
						});
						break; // success – exit retry loop
					} catch (retryErr: any) {
						if (isInFlightLimitError(retryErr) && attempt < maxRetries) {
							console.warn(
								`[createToken] In-flight limit hit (attempt ${attempt}/${maxRetries}). Waiting before retry...`,
							);
							// Wait progressively longer between retries
							await new Promise((r) => setTimeout(r, attempt * 5_000));
							// Also wait for pending txs to clear
							if (publicClient && address) {
								await waitForPendingTransactions(publicClient, address, 15_000, 2_000);
							}
							continue;
						}
						throw retryErr; // Not an in-flight error, or out of retries
					}
				}

				if (!hash) {
					throw new Error("Transaction could not be submitted after retries");
				}

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
				} else if (isInFlightLimitError(err)) {
					errorMessage =
						"Too many pending transactions. Please wait for your previous transactions to confirm, or speed them up / cancel them in your wallet settings, then try again.";
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
			walletChainId,
			evmChainId,
			writeContractAsync,
			creationFee,
			publicClient,
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
	const evmChainId = useActiveEvmChainId();

	const { data: currentPrice } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getCurrentPrice",
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: marketCap } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getMarketCap",
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: totalSupply } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "totalSupply",
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: reserveBalance } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "reserveBalance",
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress,
		},
	});

	const { data: isGraduated } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "isGraduated",
		chainId: evmChainId,
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
	const evmChainId = useActiveEvmChainId();
	const amountWei = maticAmount ? parseEther(maticAmount) : BigInt(0);

	return useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "calculateBuy",
		args: [amountWei],
		chainId: evmChainId,
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
	const evmChainId = useActiveEvmChainId();
	const amountWei = tokenAmount ? parseEther(tokenAmount) : BigInt(0);

	return useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "calculateSell",
		args: [amountWei],
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress && amountWei > BigInt(0),
		},
	});
}

// Hook: Buy tokens
export function useBuyTokens() {
	const { address } = useWagmiAccount();
	const evmChainId = useActiveEvmChainId();
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

			// Use token's chain if provided, else fall back to active EVM chain
			const targetChainId = params.chainId ?? evmChainId;

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
					chainId: targetChainId,
				});

				// Polygon/Amoy RPCs require a minimum gas tip cap (25+ Gwei)
				const isPolygonChain = [137, 80002].includes(targetChainId);
				const gasOverrides = isPolygonChain
					? { maxPriorityFeePerGas: parseGwei("30"), maxFeePerGas: parseGwei("150") }
					: {};

				const hash = await writeContractAsync({
					address: params.bondingCurveAddress,
					abi: HYPE_BONDING_CURVE_ABI,
					functionName: "buy",
					args: [minTokens],
					value: maticWei,
					chainId: targetChainId,
					...gasOverrides,
				});

				console.log("[useBuyTokens] Transaction hash:", hash);
				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to buy tokens:", err);
				if (isInFlightLimitError(err)) {
					setError(new Error("Too many pending transactions. Please wait for your previous transactions to confirm, or cancel them in your wallet."));
				} else {
					setError(
						err instanceof Error
							? err
							: new Error("Failed to buy tokens"),
					);
				}
				return null;
			} finally {
				setIsBuying(false);
			}
		},
		[address, evmChainId, writeContractAsync],
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
	const { address } = useWagmiAccount();
	const evmChainId = useActiveEvmChainId();
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

			// Use token's chain if provided, else fall back to active EVM chain
			const targetChainId = params.chainId ?? evmChainId;

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
					chainId: targetChainId,
				});

				// Polygon/Amoy RPCs require a minimum gas tip cap (25+ Gwei)
				const isPolygonChain = [137, 80002].includes(targetChainId);
				const gasOverrides = isPolygonChain
					? { maxPriorityFeePerGas: parseGwei("30"), maxFeePerGas: parseGwei("150") }
					: {};

				const hash = await writeContractAsync({
					address: params.bondingCurveAddress,
					abi: HYPE_BONDING_CURVE_ABI,
					functionName: "sell",
					args: [tokenWei, minMatic],
					chainId: targetChainId,
					...gasOverrides,
				});

				setTxHash(hash);
				return hash;
			} catch (err) {
				console.error("Failed to sell tokens:", err);
				if (isInFlightLimitError(err)) {
					setError(new Error("Too many pending transactions. Please wait for your previous transactions to confirm, or cancel them in your wallet."));
				} else {
					setError(
						err instanceof Error
							? err
							: new Error("Failed to sell tokens"),
					);
				}
				return null;
			} finally {
				setIsSelling(false);
			}
		},
		[address, evmChainId, writeContractAsync],
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
	const evmChainId = useActiveEvmChainId();
	const { walletAddress: connectedAddress } = useAuth();
	const targetAddress = userAddress || connectedAddress;

	return useReadContract({
		address: tokenAddress,
		abi: HYPE_TOKEN_ABI,
		functionName: "balanceOf",
		args: targetAddress ? [targetAddress] : undefined,
		chainId: evmChainId,
		query: {
			enabled: !!tokenAddress && !!targetAddress,
		},
	});
}

// Hook: Approve token spending
export function useApproveToken() {
	const evmChainId = useActiveEvmChainId();
	const { address } = useWagmiAccount();
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
				// Polygon/Amoy RPCs require a minimum gas tip cap (25+ Gwei)
				const isPolygonChain = [137, 80002].includes(evmChainId);
				const gasOverrides = isPolygonChain
					? { maxPriorityFeePerGas: parseGwei("30"), maxFeePerGas: parseGwei("150") }
					: {};

				const hash = await writeContractAsync({
					address: tokenAddress,
					abi: HYPE_TOKEN_ABI,
					functionName: "approve",
					args: [spenderAddress, amount],
					chainId: evmChainId,
					...gasOverrides,
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
		[address, evmChainId, writeContractAsync],
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
	const evmChainId = useActiveEvmChainId();
	const { walletAddress: ownerAddress } = useAuth();

	return useReadContract({
		address: tokenAddress,
		abi: HYPE_TOKEN_ABI,
		functionName: "allowance",
		args:
			ownerAddress && spenderAddress
				? [ownerAddress, spenderAddress]
				: undefined,
		chainId: evmChainId,
		query: {
			enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
		},
	});
}

// Hook: Get vesting info
export function useVestingInfo(bondingCurveAddress: Address | undefined) {
	const evmChainId = useActiveEvmChainId();
	const { walletAddress } = useAuth();

	const { data: vestingInfo, refetch: refetchVestingInfo } = useReadContract({
		address: bondingCurveAddress,
		abi: HYPE_BONDING_CURVE_ABI,
		functionName: "getVestingInfo",
		args: walletAddress ? [walletAddress] : undefined,
		chainId: evmChainId,
		query: {
			enabled: !!bondingCurveAddress && !!walletAddress,
		},
	});

	const { data: claimableAmount, refetch: refetchClaimable } =
		useReadContract({
			address: bondingCurveAddress,
			abi: HYPE_BONDING_CURVE_ABI,
			functionName: "getClaimableVested",
			args: walletAddress ? [walletAddress] : undefined,
			chainId: evmChainId,
			query: {
				enabled: !!bondingCurveAddress && !!walletAddress,
			},
		});

	const refetch = useCallback(async () => {
		await Promise.all([refetchVestingInfo(), refetchClaimable()]);
	}, [refetchVestingInfo, refetchClaimable]);

	return {
		vestingInfo: vestingInfo as
			| {
					totalAmount: bigint;
					claimedAmount: bigint;
					startTime: bigint;
			  }
			| undefined,
		claimableAmount: claimableAmount as bigint | undefined,
		refetch,
	};
}

// Hook: Claim vested tokens
export function useClaimVested() {
	const { address } = useWagmiAccount();
	const evmChainId = useActiveEvmChainId();
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
					chainId: evmChainId,
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
		[address, evmChainId, writeContractAsync],
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
