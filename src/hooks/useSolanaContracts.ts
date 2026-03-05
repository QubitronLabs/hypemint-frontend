/**
 * Solana Contract Interaction Hooks
 *
 * Real implementations for Solana on-chain interactions using
 * the HypeMint Anchor program via Dynamic.xyz wallet connector.
 *
 * All hooks use @solana/web3.js to build transactions and
 * Dynamic.xyz's SolanaWalletConnector to sign/send them.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import {
	isSolanaWallet,
	type SolanaWalletConnector,
} from "@dynamic-labs/solana";
import { Connection, PublicKey } from "@solana/web3.js";

import {
	buildCreateTokenTransaction,
	buildBuyWithSolTransaction,
	buildSellTransaction,
	getSolanaConnection,
	getSolanaRpcProxyUrl,
	fetchBondingCurveState,
	findATA,
	findFactoryStatePDA,
	findBondingCurvePDA,
	type BondingCurveData,
	type CreateTokenParams as ProgramCreateTokenParams,
} from "@/lib/solana/program";
import { useActiveChainType, useChainId } from "@/lib/network";
import { syncTrade } from "@/lib/api/trades";

// ============================================
// Robust Transaction Confirmation
// ============================================

/**
 * Confirm a Solana transaction with a robust fallback strategy.
 *
 * Layer 1: Try `confirmTransaction` (fast, WebSocket-based).
 * Layer 2: On timeout, poll `getSignatureStatuses` (reliable).
 * Layer 3: Last resort — `getTransaction` to check if it landed.
 *
 * Solana devnet often has slow block times causing confirmTransaction
 * to throw TransactionExpiredBlockheightExceededError even though
 * the tx eventually lands on-chain.
 */
async function confirmTransactionRobust(
	connection: Connection,
	signature: string,
	blockhash: string,
	lastValidBlockHeight: number,
	label: string = "Transaction",
): Promise<void> {
	try {
		const result = await connection.confirmTransaction(
			{ signature, blockhash, lastValidBlockHeight },
			"confirmed",
		);
		if (result.value.err) {
			throw new Error(
				`${label} failed on-chain: ${JSON.stringify(result.value.err)}`,
			);
		}
		return; // Confirmed successfully
	} catch (confirmErr: unknown) {
		// If it's our own "failed on-chain" error, re-throw immediately
		if (confirmErr instanceof Error && confirmErr.message.includes("failed on-chain")) {
			throw confirmErr;
		}

		// Timeout / block height exceeded — tx may still have landed.
		console.warn(
			`[${label}] confirmTransaction failed, polling status:`,
			confirmErr instanceof Error ? confirmErr.message : confirmErr,
		);

		const MAX_POLLS = 10;
		const POLL_INTERVAL_MS = 3000;
		for (let i = 0; i < MAX_POLLS; i++) {
			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
			try {
				const statusResp = await connection.getSignatureStatuses([signature]);
				const status = statusResp?.value?.[0];
				if (status) {
					if (status.err) {
						throw new Error(
							`${label} failed on-chain: ${JSON.stringify(status.err)}`,
						);
					}
					if (
						status.confirmationStatus === "confirmed" ||
						status.confirmationStatus === "finalized"
					) {
						return; // Confirmed via polling
					}
				}
			} catch (pollErr: unknown) {
				if (pollErr instanceof Error && pollErr.message.includes("failed on-chain")) {
					throw pollErr;
				}
			}
		}

		// Last resort: getTransaction
		try {
			const txInfo = await connection.getTransaction(signature, {
				commitment: "confirmed",
				maxSupportedTransactionVersion: 0,
			});
			if (txInfo) {
				if (txInfo.meta?.err) {
					throw new Error(
						`${label} failed on-chain: ${JSON.stringify(txInfo.meta.err)}`,
					);
				}
				return; // Confirmed via getTransaction
			}
		} catch (getTxErr: unknown) {
			if (getTxErr instanceof Error && getTxErr.message.includes("failed on-chain")) {
				throw getTxErr;
			}
		}

		throw new Error(
			`${label} confirmation timed out. The transaction may still be processing — please check your wallet and try again.`,
		);
	}
}

// ============================================
// Types (matching EVM hook signatures)
// ============================================

export interface SolanaCreateTokenParams {
	name: string;
	symbol: string;
	imageURI: string;
	description: string;
	hypeBoostEnabled: boolean;
}

export interface SolanaCreateTokenResult {
	tokenAddress: string;
	bondingCurveAddress: string;
	txSignature: string;
}

export interface SolanaBuyParams {
	bondingCurveAddress: string;
	solAmount: string; // in SOL (not lamports)
	slippageBps?: number;
	/** Optional backend token ID (nanoid) for direct DB lookup in syncTrade.
	 *  Used during initial purchase to avoid contractAddress lookup timing issues. */
	tokenId?: string;
}

export interface SolanaSellParams {
	bondingCurveAddress: string;
	tokenAddress: string;
	tokenAmount: string;
	minSol?: string;
	slippageBps?: number;
}

// ============================================
// Helper: Get Solana Connection from config
// ============================================

/**
 * Return the backend RPC proxy URL for Solana.
 * Dynamically uses the active chain ID (900=mainnet, 901=devnet)
 * from the network store so switching networks routes through
 * the correct backend proxy endpoint.
 */
function useSolanaRpcUrl(): string {
	const chainId = useChainId();
	return getSolanaRpcProxyUrl(chainId);
}

/**
 * Get a Solana Connection that ALWAYS routes through the backend
 * RPC proxy.  We intentionally skip the Dynamic.xyz connector's
 * getWalletClient() because it returns a Connection pointing at
 * public RPCs (e.g. api.mainnet-beta.solana.com) which return
 * 403 Forbidden without an API key.
 */
function getProxyConnection(rpcUrl: string): Connection {
	return getSolanaConnection(rpcUrl);
}

// ============================================
// Hook: Create a new Solana token
// ============================================

export function useSolanaCreateToken() {
	const { primaryWallet } = useDynamicContext();
	const rpcUrl = useSolanaRpcUrl();
	const [isCreating, setIsCreating] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);
	const [isConfirmed, setIsConfirmed] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [txSignature, setTxSignature] = useState<string | undefined>();

	const createToken = useCallback(
		async (
			params: SolanaCreateTokenParams,
		): Promise<SolanaCreateTokenResult | null> => {
			setIsCreating(true);
			setIsConfirming(false);
			setIsConfirmed(false);
			setError(null);
			setTxSignature(undefined);

			try {
				// Validate wallet
				if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
					throw new Error(
						"No Solana wallet connected. Please connect a Solana wallet.",
					);
				}

				const walletAddress = primaryWallet.address;
				if (!walletAddress) {
					throw new Error("Wallet address not available.");
				}

				const creatorPubkey = new PublicKey(walletAddress);

				// Get connection via backend proxy (never use wallet's direct RPC)
				const connection = getProxyConnection(rpcUrl);

				console.log(
					"[useSolanaCreateToken] Building create_token transaction...",
				);
				console.log("  Creator:", walletAddress);
				console.log("  Token:", params.name, `(${params.symbol})`);

				// Build the transaction
				const programParams: ProgramCreateTokenParams = {
					name: params.name,
					symbol: params.symbol,
					imageUri: params.imageURI,
					description: params.description,
				};

				const result = await buildCreateTokenTransaction(
					connection,
					creatorPubkey,
					programParams,
				);

				console.log(
					"[useSolanaCreateToken] Transaction built successfully",
				);
				console.log(
					"  Token Mint:",
					result.tokenMintAddress.toBase58(),
				);
				console.log(
					"  Bonding Curve:",
					result.bondingCurveAddress.toBase58(),
				);

				// Fresh blockhash right before signing (same as used for confirm)
				const { blockhash, lastValidBlockHeight } =
					await connection.getLatestBlockhash("confirmed");
				result.transaction.recentBlockhash = blockhash;

				// Get the signer from Dynamic.xyz
				const connector =
					primaryWallet.connector as unknown as SolanaWalletConnector;
				const signer = await connector.getSigner();

				if (!signer) {
					throw new Error(
						"Failed to get Solana signer from wallet.",
					);
				}

				// Sign the transaction with the user's wallet
				// (tokenMint keypair already partially signed in buildCreateTokenTransaction)
				console.log(
					"[useSolanaCreateToken] Requesting wallet signature...",
				);
				const signedTx = await signer.signTransaction(
					result.transaction,
				);

				setIsCreating(false);
				setIsConfirming(true);

				// Send with retries — devnet can drop transactions
				console.log(
					"[useSolanaCreateToken] Sending transaction to network...",
				);
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: true,
						maxRetries: 3,
					},
				);

				setTxSignature(signature);
				console.log(
					"[useSolanaCreateToken] Transaction sent:",
					signature,
				);

				// Confirm using the SAME blockhash used in the transaction
				await confirmTransactionRobust(
					connection, signature, blockhash, lastValidBlockHeight, "Solana create",
				);

				console.log(
					"[useSolanaCreateToken] Transaction confirmed!",
				);
				setIsConfirming(false);
				setIsConfirmed(true);

				return {
					tokenAddress: result.tokenMintAddress.toBase58(),
					bondingCurveAddress:
						result.bondingCurveAddress.toBase58(),
					txSignature: signature,
				};
			} catch (err) {
				console.error("[useSolanaCreateToken] Error:", err);
				const errorMessage =
					err instanceof Error
						? err.message
						: "Failed to create Solana token";
				setError(new Error(errorMessage));
				setIsCreating(false);
				setIsConfirming(false);
				return null;
			}
		},
		[primaryWallet, rpcUrl],
	);

	return {
		createToken,
		isCreating,
		isConfirming,
		isConfirmed,
		txSignature,
		error,
		reset: () => {
			setTxSignature(undefined);
			setError(null);
			setIsCreating(false);
			setIsConfirming(false);
			setIsConfirmed(false);
		},
	};
}

// ============================================
// Hook: Buy Solana tokens
// ============================================

export function useSolanaBuyTokens() {
	const { primaryWallet } = useDynamicContext();
	const rpcUrl = useSolanaRpcUrl();
	const chainId = useChainId();
	const [isBuying, setIsBuying] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);
	const [isConfirmed, setIsConfirmed] = useState(false);
	const [isFailed, setIsFailed] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [txSignature, setTxSignature] = useState<string | undefined>();

	const buy = useCallback(
		async (params: SolanaBuyParams): Promise<string | null> => {
			setIsBuying(true);
			setIsConfirming(false);
			setIsConfirmed(false);
			setIsFailed(false);
			setError(null);
			setTxSignature(undefined);

			try {
				if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
					throw new Error("No Solana wallet connected.");
				}

				const walletAddress = primaryWallet.address;
				if (!walletAddress) {
					throw new Error("Wallet address not available.");
				}

				const buyerPubkey = new PublicKey(walletAddress);
				const connection = getProxyConnection(rpcUrl);

				// Fetch the bonding curve state to get the token mint
				const bondingCurvePubkey = new PublicKey(
					params.bondingCurveAddress,
				);
				const curveState = await fetchBondingCurveState(
					connection,
					bondingCurvePubkey,
				);

				// Convert SOL to lamports (1 SOL = 1e9 lamports)
				const solFloat = parseFloat(params.solAmount);
				const lamports = BigInt(
					Math.round(solFloat * 1_000_000_000),
				);

				if (lamports <= 0n) {
					throw new Error(
						"Amount too small. Minimum is 0.000000001 SOL (1 lamport).",
					);
				}

				// The on-chain LINEAR bonding curve gives wrong/zero token amounts.
				// Set minTokensOut=0 since pricing is handled by backend CPMM.
				// The backend syncTrade endpoint uses simulateBuyWithNative() to compute
				// the authoritative token amounts after the on-chain SOL transfer succeeds.
				const minTokensOut = 0n;

				const transaction = await buildBuyWithSolTransaction(
					connection,
					buyerPubkey,
					{
						tokenMint: curveState.tokenMint,
						solAmount: lamports,
						minTokensOut,
					},
				);

				// Get a FRESH blockhash right before signing to maximize the
				// validity window. The build function fetches one earlier, but
				// time passes during intermediate RPC calls (fetchBondingCurveState,
				// getAccountInfo, etc.). We reuse this SAME blockhash for
				// confirmTransaction to avoid timeout mismatches.
				const { blockhash, lastValidBlockHeight } =
					await connection.getLatestBlockhash("confirmed");
				transaction.recentBlockhash = blockhash;

				// Sign with wallet
				const connector =
					primaryWallet.connector as unknown as SolanaWalletConnector;
				const signer = await connector.getSigner();
				if (!signer) {
					throw new Error("Failed to get Solana signer.");
				}
				const signedTx = await signer.signTransaction(transaction);

				setIsBuying(false);
				setIsConfirming(true);

				// Send with retries — devnet can drop transactions
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: true,
						maxRetries: 3,
					},
				);
				setTxSignature(signature);

				// Robust confirmation with polling fallback for devnet reliability
				await confirmTransactionRobust(
					connection, signature, blockhash, lastValidBlockHeight, "Solana buy",
				);

				setIsConfirming(false);

				// Sync trade to backend for stats, chart, and WebSocket updates.
				// The backend computes the CPMM token amount (on-chain gives wrong/0 tokens).
				// We pass nativeAmount so the backend can use simulateBuyWithNative().
				// Use params.tokenId (backend DB ID) if provided for direct lookup,
				// otherwise fall back to the on-chain tokenMint address.
				const syncTokenId = params.tokenId || curveState.tokenMint.toBase58();
				try {
					const syncResult = await syncTrade({
						txHash: signature,
						tokenId: syncTokenId,
					chainId: chainId ?? 901,
						type: "buy",
						nativeAmount: lamports.toString(),
						tokenAmount: "0", // Backend will compute via CPMM
					});
					if (!syncResult.synced) {
						console.warn("[useSolanaBuyTokens] syncTrade not synced:", syncResult.reason);
					}
				} catch (reportErr) {
					console.error("[useSolanaBuyTokens] syncTrade failed:", reportErr);
				}

				// Set confirmed AFTER syncTrade completes to prevent useEffect race condition
				// (useEffect would otherwise call syncTrade with 0 amounts before this one finishes)
				setIsConfirmed(true);

				return signature;
			} catch (err) {
				console.error("[useSolanaBuyTokens] Error:", err);
				const wrappedError =
					err instanceof Error
						? err
						: new Error("Failed to buy Solana tokens");
				setError(wrappedError);
				setIsBuying(false);
				setIsConfirming(false);
				setIsFailed(true);
				// Re-throw so callers can display the specific error message
				throw wrappedError;
			}
		},
		[primaryWallet, rpcUrl, chainId],
	);

	return {
		buy,
		isBuying,
		isConfirming,
		isConfirmed,
		isFailed,
		txSignature,
		error,
		reset: () => {
			setTxSignature(undefined);
			setError(null);
			setIsBuying(false);
			setIsConfirming(false);
			setIsConfirmed(false);
			setIsFailed(false);
		},
	};
}

// ============================================
// Hook: Sell Solana tokens
// ============================================

export function useSolanaSellTokens() {
	const { primaryWallet } = useDynamicContext();
	const rpcUrl = useSolanaRpcUrl();
	const chainId = useChainId();
	const [isSelling, setIsSelling] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);
	const [isConfirmed, setIsConfirmed] = useState(false);
	const [isFailed, setIsFailed] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [txSignature, setTxSignature] = useState<string | undefined>();

	const sell = useCallback(
		async (params: SolanaSellParams): Promise<string | null> => {
			setIsSelling(true);
			setIsConfirming(false);
			setIsConfirmed(false);
			setIsFailed(false);
			setError(null);
			setTxSignature(undefined);

			try {
				if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
					throw new Error("No Solana wallet connected.");
				}

				const walletAddress = primaryWallet.address;
				if (!walletAddress) {
					throw new Error("Wallet address not available.");
				}

				const sellerPubkey = new PublicKey(walletAddress);
				const connection = getProxyConnection(rpcUrl);

				const tokenMint = new PublicKey(params.tokenAddress);

				// Convert token amount (string with decimals) to smallest unit
				// Token uses 9 decimals in the CPMM system
				const tokenFloat = parseFloat(params.tokenAmount);
				const tokenSmallest = BigInt(
					Math.round(tokenFloat * 1_000_000_000),
				);

				if (tokenSmallest <= 0n) {
					throw new Error(
						"Amount too small. Minimum is 0.000000001 tokens.",
					);
				}

				// Fetch bonding curve state BEFORE the sell to calculate slippage + actual SOL received
				const [factoryStatePDA] = findFactoryStatePDA();
				const [bondingCurvePDA] = findBondingCurvePDA(
					factoryStatePDA,
					tokenMint,
				);
				let reserveBefore = BigInt(0);
				let curveStateBefore: Awaited<ReturnType<typeof fetchBondingCurveState>> | null = null;
				try {
					curveStateBefore = await fetchBondingCurveState(
						connection,
						bondingCurvePDA,
					);
					reserveBefore = curveStateBefore.reserveBalance;
				} catch (e) {
					console.warn("[useSolanaSellTokens] Could not fetch pre-sell curve state");
				}

				// Calculate min SOL out with slippage protection
				// If explicit minSol provided, use it; otherwise estimate from curve state
				let minSolOut: bigint;
				if (params.minSol) {
					minSolOut = BigInt(Math.round(parseFloat(params.minSol) * 1_000_000_000));
				} else if (curveStateBefore) {
					// Calculate expected SOL from bonding curve math, apply slippage tolerance
					const slippageBps = params.slippageBps ?? 100; // default 1%
					const expectedSol = calculateSolForTokens(
						tokenSmallest,
						curveStateBefore.totalSupply,
						curveStateBefore.slope,
						curveStateBefore.basePrice,
					);
					minSolOut = expectedSol > 0n
						? expectedSol - (expectedSol * BigInt(slippageBps) / 10_000n)
						: 0n;
				} else {
					minSolOut = 0n;
				}

				console.log(
					`[useSolanaSellTokens] Selling ${params.tokenAmount} tokens`,
				);

				const transaction = await buildSellTransaction(
					connection,
					sellerPubkey,
					{
						tokenMint,
						tokenAmount: tokenSmallest,
						minSolOut,
					},
				);

				// Fresh blockhash right before signing (same as used for confirm)
				const { blockhash, lastValidBlockHeight } =
					await connection.getLatestBlockhash("confirmed");
				transaction.recentBlockhash = blockhash;

				// Sign with wallet
				const connector =
					primaryWallet.connector as unknown as SolanaWalletConnector;
				const signer = await connector.getSigner();
				if (!signer) {
					throw new Error("Failed to get Solana signer.");
				}
				const signedTx = await signer.signTransaction(transaction);

				setIsSelling(false);
				setIsConfirming(true);

				// Send with retries — devnet can drop transactions
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: true,
						maxRetries: 3,
					},
				);
				setTxSignature(signature);

				// Confirm using the SAME blockhash used in the transaction
				await confirmTransactionRobust(
					connection, signature, blockhash, lastValidBlockHeight, "Solana sell",
				);

				setIsConfirming(false);

				// Fetch updated bonding curve state to calculate actual SOL received
				let actualSolReceived = minSolOut.toString(); // fallback to minSolOut
				try {
					const updatedCurveState = await fetchBondingCurveState(
						connection,
						bondingCurvePDA,
					);
					const reserveAfter = updatedCurveState.reserveBalance;
					const solDelta = reserveBefore - reserveAfter;
					if (solDelta > BigInt(0)) {
						actualSolReceived = solDelta.toString();
					}
				} catch (e) {
					console.warn("[useSolanaSellTokens] Could not fetch updated curve state, using fallback");
				}

				// Sync trade to backend for stats, chart, and WebSocket updates
				try {
					await syncTrade({
						txHash: signature,
						tokenId: params.tokenAddress,
					chainId: chainId ?? 901,
						type: "sell",
						nativeAmount: actualSolReceived,
						tokenAmount: tokenSmallest.toString(),
					});
				} catch (reportErr) {
					// Non-critical: trade will be picked up by backend polling
				}

				// Set confirmed AFTER syncTrade completes to prevent useEffect race condition
				setIsConfirmed(true);

				return signature;
			} catch (err) {
				console.error("[useSolanaSellTokens] Error:", err);
				setError(
					err instanceof Error
						? err
						: new Error("Failed to sell Solana tokens"),
				);
				setIsSelling(false);
				setIsConfirming(false);
				setIsFailed(true);
				return null;
			}
		},
		[primaryWallet, rpcUrl, chainId],
	);

	return {
		sell,
		isSelling,
		isConfirming,
		isConfirmed,
		isFailed,
		txSignature,
		error,
		reset: () => {
			setTxSignature(undefined);
			setError(null);
			setIsSelling(false);
			setIsConfirming(false);
			setIsConfirmed(false);
			setIsFailed(false);
		},
	};
}

// ============================================
// Hook: Get Solana token balance
// ============================================

export function useSolanaTokenBalance(
	tokenAddress?: string,
	userAddress?: string,
) {
	const { primaryWallet } = useDynamicContext();
	const rpcUrl = useSolanaRpcUrl();
	const [data, setData] = useState<bigint | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const walletAddress = userAddress || primaryWallet?.address;

	const fetchBalance = useCallback(async () => {
		if (!tokenAddress || !walletAddress) {
			setData(undefined);
			return;
		}

		try {
			setIsLoading(true);
			const connection = getProxyConnection(rpcUrl);

			const mint = new PublicKey(tokenAddress);
			const owner = new PublicKey(walletAddress);
			const ata = findATA(owner, mint);

			const ataInfo = await connection.getAccountInfo(ata);
			if (!ataInfo) {
				setData(BigInt(0));
				return;
			}

			// SPL Token account data layout: amount is at offset 64, 8 bytes u64 LE
			const dataBytes = new Uint8Array(ataInfo.data);
			const view = new DataView(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength);
			const amount = view.getBigUint64(64, true);
			setData(amount);
			setError(null);
		} catch (err) {
			console.error(
				"[useSolanaTokenBalance] Failed to fetch:",
				err,
			);
			setError(
				err instanceof Error
					? err
					: new Error("Failed to fetch token balance"),
			);
			setData(undefined);
		} finally {
			setIsLoading(false);
		}
	}, [tokenAddress, walletAddress, rpcUrl]);

	useEffect(() => {
		fetchBalance();

		intervalRef.current = setInterval(fetchBalance, 15_000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchBalance]);

	return { data, isLoading, error, refetch: fetchBalance };
}

// ============================================
// Hook: Get Solana native balance (real impl)
// ============================================

/**
 * Fetches the SOL balance for the connected Solana wallet
 * using Dynamic.xyz's SolanaWalletConnector.getBalance().
 *
 * Returns data in a shape compatible with Wagmi's useBalance:
 *   { value: bigint (lamports), decimals: 9, symbol: 'SOL', formatted: string }
 */
export function useSolanaNativeBalance() {
	const { primaryWallet } = useDynamicContext();
	const activeChainType = useActiveChainType();
	const rpcUrl = useSolanaRpcUrl();
	const [data, setData] = useState<
		| {
				value: bigint;
				decimals: number;
				symbol: string;
				formatted: string;
		  }
		| undefined
	>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

	// Use stable wallet address as dependency (not the wallet object which changes identity)
	const walletAddress = primaryWallet?.address;
	const walletRef = useRef(primaryWallet);
	walletRef.current = primaryWallet;

	const fetchBalance = useCallback(async () => {
		// Only fetch when active chain is Solana
		if (activeChainType !== "SOLANA") {
			setData(undefined);
			return;
		}

		const wallet = walletRef.current;

		// Try getting address from wallet or fallback
		const address = wallet?.address;
		if (!address) {
			setData(undefined);
			return;
		}

		try {
			setIsLoading(true);

			// Always use the backend proxy — never the wallet connector's
			// internal RPC which points at public endpoints like
			// api.mainnet-beta.solana.com and returns 403 Forbidden.
			const connection = getProxyConnection(rpcUrl);
			const pubkey = new PublicKey(address);
			const lamports = await connection.getBalance(pubkey);
			const solFloat = lamports / 1e9;

			setData({
				value: BigInt(lamports),
				decimals: 9,
				symbol: "SOL",
				formatted: solFloat.toFixed(9),
			});
			setError(null);
		} catch (err) {
			console.error(
				"[useSolanaNativeBalance] Failed to fetch:",
				err,
			);
			setError(
				err instanceof Error
					? err
					: new Error("Failed to fetch SOL balance"),
			);
			
			setData(undefined);
		} finally {
			setIsLoading(false);
		}
	}, [walletAddress, activeChainType, rpcUrl]); // Re-fetch when chain type or wallet changes

	// Fetch on mount & when wallet/chain changes, and poll every 15s
	useEffect(() => {
		fetchBalance();

		intervalRef.current = setInterval(fetchBalance, 15_000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchBalance]);

	return { data, isLoading, error, refetch: fetchBalance };
}

// ============================================
// Hook: Get Solana bonding curve state
// ============================================

export function useSolanaBondingCurveState(tokenAddress?: string) {
	const { primaryWallet } = useDynamicContext();
	const rpcUrl = useSolanaRpcUrl();
	const [data, setData] = useState<BondingCurveData | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchState = useCallback(async () => {
		if (!tokenAddress) {
			setData(undefined);
			return;
		}

		try {
			setIsLoading(true);
			const connection = getProxyConnection(rpcUrl);

			const tokenMint = new PublicKey(tokenAddress);
			const [factoryStatePDA] = findFactoryStatePDA();
			const [bondingCurvePDA] = findBondingCurvePDA(factoryStatePDA, tokenMint);

			const curveState = await fetchBondingCurveState(connection, bondingCurvePDA);
			setData(curveState);
			setError(null);
		} catch (err) {
			// "not found" is expected when the token doesn't have a bonding
			// curve on the current chain — log as warn, not error.
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("not found")) {
				console.warn("[useSolanaBondingCurveState]", msg);
			} else {
				console.error("[useSolanaBondingCurveState] Failed to fetch:", err);
			}
			setError(
				err instanceof Error
					? err
					: new Error("Failed to fetch bonding curve state"),
			);
			setData(undefined);
		} finally {
			setIsLoading(false);
		}
	}, [tokenAddress, rpcUrl]);

	useEffect(() => {
		fetchState();
		intervalRef.current = setInterval(fetchState, 15_000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchState]);

	return { data, isLoading, error, refetch: fetchState };
}

// ============================================
// Solana bonding curve math (client-side)
// ============================================

/**
 * Integer square root using Newton's method (matching on-chain implementation)
 */
function integerSqrt(n: bigint): bigint {
	if (n <= 0n) return 0n;
	let x = n;
	let y = (x + 1n) / 2n;
	while (y < x) {
		x = y;
		y = (x + n / x) / 2n;
	}
	return x;
}

/**
 * Calculate tokens received for a given SOL amount (lamports)
 * Matches on-chain: calculate_tokens_for_sol
 */
export function calculateTokensForSol(
	solAmount: bigint,
	currentSupply: bigint,
	slope: bigint,
	basePrice: bigint,
): bigint {
	if (solAmount <= 0n) return 0n;

	const bCoeff = slope * currentSupply + basePrice;
	const bSq = bCoeff * bCoeff;
	const twoMC = 2n * slope * solAmount;
	const discriminant = bSq + twoMC;

	const sqrtDisc = integerSqrt(discriminant);
	if (sqrtDisc <= bCoeff) return 0n;

	return (sqrtDisc - bCoeff) / slope;
}

/**
 * Calculate SOL returned for selling tokens
 * Matches on-chain: calculate_sol_for_tokens
 */
export function calculateSolForTokens(
	tokenAmount: bigint,
	currentSupply: bigint,
	slope: bigint,
	basePrice: bigint,
): bigint {
	if (tokenAmount <= 0n) return 0n;

	const halfN = tokenAmount / 2n;
	const sMinus = currentSupply - halfN;
	const slopeComponent = slope * tokenAmount * sMinus;
	const baseComponent = basePrice * tokenAmount;

	return slopeComponent + baseComponent;
}

/**
 * Calculate current price: P = slope * supply + base_price (in lamports)
 */
export function calculateCurrentPrice(
	supply: bigint,
	slope: bigint,
	basePrice: bigint,
): bigint {
	return slope * supply + basePrice;
}
