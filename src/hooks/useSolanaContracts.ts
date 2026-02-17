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
	fetchBondingCurveState,
	findATA,
	findFactoryStatePDA,
	findBondingCurvePDA,
	type BondingCurveData,
	type CreateTokenParams as ProgramCreateTokenParams,
} from "@/lib/solana/program";
import { useContractConfigStore } from "./useContractConfig";
import { useActiveChainType } from "@/lib/network";
import { recordOnChainTrade } from "@/lib/api/trades";

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

function useSolanaRpcUrl(): string | null {
	const deployments = useContractConfigStore((s) => s.deployments);
	const solanaDeployment = deployments.find(
		(d) => d.chainType === "SOLANA" && d.isActive,
	);
	return solanaDeployment?.rpcUrl ?? null;
}

/**
 * Get a Solana Connection from Dynamic.xyz connector or create one from config RPC
 */
function getConnectionFromWalletOrConfig(
	wallet: unknown,
	rpcUrl: string | null,
): Connection {
	// Try to get connection from Dynamic.xyz wallet connector first
	if (wallet && typeof wallet === "object" && "connector" in wallet && isSolanaWallet(wallet as Parameters<typeof isSolanaWallet>[0])) {
		try {
			const w = wallet as { connector: unknown };
			const connector =
				w.connector as unknown as SolanaWalletConnector;
			const connection = connector.getWalletClient();
			// @ts-expect-error - getWalletClient may return null if not connected, handle that case
			if (connection) return connection;
		} catch {
			// Fall through to manual connection
		}
	}

	// Fallback: create from config RPC URL
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

				// Get connection
				const connection = getConnectionFromWalletOrConfig(
					primaryWallet,
					rpcUrl,
				);

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
					// @ts-expect-error - result.transaction is a Transaction but TypeScript may not recognize it as such
					result.transaction,
				);

				setIsCreating(false);
				setIsConfirming(true);

				// Send the signed transaction
				console.log(
					"[useSolanaCreateToken] Sending transaction to network...",
				);
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: false,
						preflightCommitment: "confirmed",
					},
				);

				setTxSignature(signature);
				console.log(
					"[useSolanaCreateToken] Transaction sent:",
					signature,
				);

				// Wait for confirmation
				const latestBlockhash =
					await connection.getLatestBlockhash("confirmed");
				await connection.confirmTransaction(
					{
						signature,
						blockhash: latestBlockhash.blockhash,
						lastValidBlockHeight:
							latestBlockhash.lastValidBlockHeight,
					},
					"confirmed",
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
				const connection = getConnectionFromWalletOrConfig(
					primaryWallet,
					rpcUrl,
				);

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

				// Set minTokensOut to 0 for now (no slippage protection)
				// In production, use a quote endpoint to calculate expected tokens
				const minTokensOut = BigInt(0);

				console.log(
					`[useSolanaBuyTokens] Buying with ${params.solAmount} SOL (${lamports} lamports)`,
				);

				const transaction = await buildBuyWithSolTransaction(
					connection,
					buyerPubkey,
					{
						tokenMint: curveState.tokenMint,
						solAmount: lamports,
						minTokensOut,
					},
				);

				// Sign with wallet
				const connector =
					primaryWallet.connector as unknown as SolanaWalletConnector;
				const signer = await connector.getSigner();
				if (!signer) {
					throw new Error("Failed to get Solana signer.");
				}
// @ts-expect-error - result.transaction is a Transaction but TypeScript may not recognize it as such
				const signedTx = await signer.signTransaction(transaction);

				setIsBuying(false);
				setIsConfirming(true);

				// Send
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: false,
						preflightCommitment: "confirmed",
					},
				);
				setTxSignature(signature);

				// Confirm
				const latestBlockhash =
					await connection.getLatestBlockhash("confirmed");
				await connection.confirmTransaction(
					{
						signature,
						blockhash: latestBlockhash.blockhash,
						lastValidBlockHeight:
							latestBlockhash.lastValidBlockHeight,
					},
					"confirmed",
				);

				setIsConfirming(false);
				setIsConfirmed(true);
				console.log(
					"[useSolanaBuyTokens] Buy confirmed:",
					signature,
				);

				// Fetch updated bonding curve state to calculate actual tokens received
				let actualTokenAmount = lamports.toString(); // fallback
				try {
					const updatedCurveState = await fetchBondingCurveState(
						connection,
						bondingCurvePubkey,
					);
					const supplyBefore = curveState.totalSupply;
					const supplyAfter = updatedCurveState.totalSupply;
					const tokenDelta = supplyAfter - supplyBefore;
					if (tokenDelta > BigInt(0)) {
						actualTokenAmount = tokenDelta.toString();
					}
					console.log("[useSolanaBuyTokens] Token amount received:", actualTokenAmount);
				} catch (e) {
					console.warn("[useSolanaBuyTokens] Could not fetch updated curve state, using fallback");
				}

				// Report trade to backend for stats, chart, and WebSocket updates
				try {
					await recordOnChainTrade({
						tokenId: curveState.tokenMint.toBase58(),
						bondingCurveAddress: params.bondingCurveAddress,
						type: "buy",
						maticAmount: lamports.toString(),
						tokenAmount: actualTokenAmount,
						txHash: signature,
					});
					console.log("[useSolanaBuyTokens] Trade reported to backend");
				} catch (reportErr) {
					console.warn("[useSolanaBuyTokens] Failed to report trade:", reportErr);
				}

				return signature;
			} catch (err) {
				console.error("[useSolanaBuyTokens] Error:", err);
				setError(
					err instanceof Error
						? err
						: new Error("Failed to buy Solana tokens"),
				);
				setIsBuying(false);
				setIsConfirming(false);
				setIsFailed(true);
				return null;
			}
		},
		[primaryWallet, rpcUrl],
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
				const connection = getConnectionFromWalletOrConfig(
					primaryWallet,
					rpcUrl,
				);

				const tokenMint = new PublicKey(params.tokenAddress);

				// Convert token amount (string with decimals) to smallest unit
				// Token has 6 decimals (TOKEN_DECIMALS from program)
				const tokenFloat = parseFloat(params.tokenAmount);
				const tokenSmallest = BigInt(
					Math.round(tokenFloat * 1_000_000),
				);

				if (tokenSmallest <= 0n) {
					throw new Error(
						"Amount too small. Minimum is 0.000001 tokens.",
					);
				}

				// Calculate min SOL out with slippage
				const minSolOut = params.minSol
					? BigInt(
							Math.round(
								parseFloat(params.minSol) * 1_000_000_000,
							),
						)
					: BigInt(0);

				console.log(
					`[useSolanaSellTokens] Selling ${params.tokenAmount} tokens`,
				);

				// Fetch bonding curve state BEFORE the sell to calculate actual SOL received
				const [factoryStatePDA] = findFactoryStatePDA();
				const [bondingCurvePDA] = findBondingCurvePDA(
					factoryStatePDA,
					tokenMint,
				);
				let reserveBefore = BigInt(0);
				try {
					const curveStateBefore = await fetchBondingCurveState(
						connection,
						bondingCurvePDA,
					);
					reserveBefore = curveStateBefore.reserveBalance;
				} catch (e) {
					console.warn("[useSolanaSellTokens] Could not fetch pre-sell curve state");
				}

				const transaction = await buildSellTransaction(
					connection,
					sellerPubkey,
					{
						tokenMint,
						tokenAmount: tokenSmallest,
						minSolOut,
					},
				);

				// Sign with wallet
				const connector =
					primaryWallet.connector as unknown as SolanaWalletConnector;
				const signer = await connector.getSigner();
				if (!signer) {
					throw new Error("Failed to get Solana signer.");
				}
// @ts-expect-error - result.transaction is a Transaction but TypeScript may not recognize it as such
				const signedTx = await signer.signTransaction(transaction);

				setIsSelling(false);
				setIsConfirming(true);

				// Send
				const signature = await connection.sendRawTransaction(
					signedTx.serialize(),
					{
						skipPreflight: false,
						preflightCommitment: "confirmed",
					},
				);
				setTxSignature(signature);

				// Confirm
				const latestBlockhash =
					await connection.getLatestBlockhash("confirmed");
				await connection.confirmTransaction(
					{
						signature,
						blockhash: latestBlockhash.blockhash,
						lastValidBlockHeight:
							latestBlockhash.lastValidBlockHeight,
					},
					"confirmed",
				);

				setIsConfirming(false);
				setIsConfirmed(true);
				console.log(
					"[useSolanaSellTokens] Sell confirmed:",
					signature,
				);

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
					console.log("[useSolanaSellTokens] SOL received:", actualSolReceived);
				} catch (e) {
					console.warn("[useSolanaSellTokens] Could not fetch updated curve state, using fallback");
				}

				// Report trade to backend for stats, chart, and WebSocket updates
				try {
					await recordOnChainTrade({
						tokenId: params.tokenAddress,
						bondingCurveAddress: params.bondingCurveAddress,
						type: "sell",
						maticAmount: actualSolReceived,
						tokenAmount: tokenSmallest.toString(),
						txHash: signature,
					});
					console.log("[useSolanaSellTokens] Trade reported to backend");
				} catch (reportErr) {
					console.warn("[useSolanaSellTokens] Failed to report trade:", reportErr);
				}

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
		[primaryWallet, rpcUrl],
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
			const connection = getConnectionFromWalletOrConfig(
				primaryWallet ?? null,
				rpcUrl,
			);

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
	}, [tokenAddress, walletAddress, primaryWallet, rpcUrl]);

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

			// Prefer direct RPC call for reliability across wallet switches
			if (wallet && isSolanaWallet(wallet)) {
				// Use Dynamic's connector getBalance - returns SOL as string
				const solanaConnector =
					wallet.connector as unknown as SolanaWalletConnector;
				const balanceSol = await solanaConnector.getBalance(address);

				if (balanceSol === undefined || balanceSol === null) {
					setData(undefined);
					return;
				}

				const solFloat = parseFloat(balanceSol);
				const lamports = BigInt(Math.round(solFloat * 1e9));

				setData({
					value: lamports,
					decimals: 9,
					symbol: "SOL",
					formatted: solFloat.toFixed(9),
				});
			} else {
				// Fallback: direct RPC call when Dynamic wallet is not Solana type
				// This happens when user switches chains in our UI but Dynamic
				// primaryWallet hasn't changed yet
				try {
					const connection = getSolanaConnection(rpcUrl);
					const pubkey = new PublicKey(address);
					const lamports = await connection.getBalance(pubkey);
					const solFloat = lamports / 1e9;

					setData({
						value: BigInt(lamports),
						decimals: 9,
						symbol: "SOL",
						formatted: solFloat.toFixed(9),
					});
				} catch {
					// Address might not be a valid Solana pubkey
					setData(undefined);
				}
			}
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
			const connection = getConnectionFromWalletOrConfig(
				primaryWallet ?? null,
				rpcUrl,
			);

			const tokenMint = new PublicKey(tokenAddress);
			const [factoryStatePDA] = findFactoryStatePDA();
			const [bondingCurvePDA] = findBondingCurvePDA(factoryStatePDA, tokenMint);

			const curveState = await fetchBondingCurveState(connection, bondingCurvePDA);
			setData(curveState);
			setError(null);
		} catch (err) {
			console.error("[useSolanaBondingCurveState] Failed to fetch:", err);
			setError(
				err instanceof Error
					? err
					: new Error("Failed to fetch bonding curve state"),
			);
			setData(undefined);
		} finally {
			setIsLoading(false);
		}
	}, [tokenAddress, primaryWallet, rpcUrl]);

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
