/**
 * HypeMint Solana Program Utilities
 *
 * Instruction builders, PDA derivation, and account deserialization
 * for the HypeMint Anchor program on Solana.
 *
 * Program ID: ASuBQBNhrE82V1Aa5iYWh2AdZwqoY312EjRVdsDxKJrs
 */

import {
	Connection,
	Keypair,
	PublicKey,
	SystemProgram,
	Transaction,
	TransactionInstruction,
} from "@solana/web3.js";
   
// ─── Constants ───────────────────────────────────────────────────

export const HYPEMINT_PROGRAM_ID = new PublicKey(
	"ASuBQBNhrE82V1Aa5iYWh2AdZwqoY312EjRVdsDxKJrs",
);

export const TOKEN_PROGRAM_ID = new PublicKey(
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
	"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** Default slope for bonding curve (matches on-chain DEFAULT_SLOPE) */
export const DEFAULT_SLOPE = BigInt(10_000);
/** Default base price in lamports (matches on-chain DEFAULT_BASE_PRICE) */
export const DEFAULT_BASE_PRICE = BigInt(1_000_000);
/** Token decimals */
export const TOKEN_DECIMALS = 6;

/**
 * Solana RPC URL — routes through the backend proxy so private API keys
 * stay server-side.  Falls back to the free public devnet endpoint.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SOLANA_DEVNET_CHAIN_ID = 901;
export const SOLANA_RPC_PROXY_URL = `${API_URL}/api/v1/rpc/${SOLANA_DEVNET_CHAIN_ID}`;
/** @deprecated Use SOLANA_RPC_PROXY_URL — kept for any external callers */
export const SOLANA_DEVNET_RPC = SOLANA_RPC_PROXY_URL;

// ─── Anchor Instruction Discriminators ───────────────────────────
// Computed as sha256("global:<instruction_name>")[0..8]

const DISCRIMINATORS = {
	initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
	create_token: new Uint8Array([84, 52, 204, 228, 24, 140, 234, 75]),
	buy_with_sol: new Uint8Array([49, 57, 124, 194, 240, 20, 216, 102]),
	sell: new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]),
} as const;

// ─── PDA Derivation ──────────────────────────────────────────────

/**
 * Derive the factory state PDA
 * Seeds: [b"factory"]
 */
export function findFactoryStatePDA(): [PublicKey, number] {
	return PublicKey.findProgramAddressSync(
		[new TextEncoder().encode("factory")],
		HYPEMINT_PROGRAM_ID,
	);
}

/**
 * Derive the token info PDA
 * Seeds: [b"token_info", token_mint.key()]
 */
export function findTokenInfoPDA(tokenMint: PublicKey): [PublicKey, number] {
	return PublicKey.findProgramAddressSync(
		[new TextEncoder().encode("token_info"), tokenMint.toBuffer()],
		HYPEMINT_PROGRAM_ID,
	);
}

/**
 * Derive the bonding curve PDA
 * Seeds: [b"bonding_curve", factory_state.key(), token_mint.key()]
 */
export function findBondingCurvePDA(
	factoryState: PublicKey,
	tokenMint: PublicKey,
): [PublicKey, number] {
	return PublicKey.findProgramAddressSync(
		[
			new TextEncoder().encode("bonding_curve"),
			factoryState.toBuffer(),
			tokenMint.toBuffer(),
		],
		HYPEMINT_PROGRAM_ID,
	);
}

/**
 * Derive the curve vault PDA (holds SOL reserves)
 * Seeds: [b"curve_vault", bonding_curve.key()]
 */
export function findCurveVaultPDA(
	bondingCurve: PublicKey,
): [PublicKey, number] {
	return PublicKey.findProgramAddressSync(
		[new TextEncoder().encode("curve_vault"), bondingCurve.toBuffer()],
		HYPEMINT_PROGRAM_ID,
	);
}

/**
 * Derive Associated Token Account address
 */
export function findATA(
	owner: PublicKey,
	mint: PublicKey,
): PublicKey {
	const [ata] = PublicKey.findProgramAddressSync(
		[owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
		ASSOCIATED_TOKEN_PROGRAM_ID,
	);
	return ata;
}

// ─── Cross-platform byte helpers ─────────────────────────────────

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
	const total = arrays.reduce((acc, a) => acc + a.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

function readU16LE(data: Uint8Array, offset: number): number {
	return data[offset] | (data[offset + 1] << 8);
}

function readU64LE(data: Uint8Array, offset: number): bigint {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	return view.getBigUint64(offset, true);
}

function writeU32LE(value: number): Uint8Array {
	const buf = new Uint8Array(4);
	const view = new DataView(buf.buffer);
	view.setUint32(0, value, true);
	return buf;
}

function writeU64LE(value: bigint): Uint8Array {
	const buf = new Uint8Array(8);
	const view = new DataView(buf.buffer);
	view.setBigUint64(0, value, true);
	return buf;
}

// ─── Borsh Serialization Helpers ─────────────────────────────────

function serializeBorshString(s: string): Uint8Array {
	const encoded = new TextEncoder().encode(s);
	return concatBytes(writeU32LE(encoded.length), encoded);
}

function serializeBorshU64(n: bigint): Uint8Array {
	return writeU64LE(n);
}

// ─── Account Deserialization ─────────────────────────────────────

export interface FactoryStateData {
	owner: PublicKey;
	protocolFeeRecipient: PublicKey;
	protocolFeeBps: number;
	creatorFeeBps: number;
	creationFee: bigint;
	graduationThreshold: bigint;
	tokenCount: bigint;
	isPaused: boolean;
	bump: number;
}

export interface BondingCurveData {
	tokenMint: PublicKey;
	factory: PublicKey;
	creator: PublicKey;
	totalSupply: bigint;
	reserveBalance: bigint;
	slope: bigint;
	basePrice: bigint;
	protocolFeeBps: number;
	creatorFeeBps: number;
	protocolFeeRecipient: PublicKey;
	graduationThreshold: bigint;
	isGraduated: boolean;
	isPaused: boolean;
	bump: number;
}

/**
 * Deserialize a FactoryState account (skips 8-byte Anchor discriminator)
 */
export function deserializeFactoryState(data: Uint8Array): FactoryStateData {
	let offset = 8; // Skip Anchor discriminator

	const owner = new PublicKey(data.slice(offset, offset + 32));
	offset += 32;

	const protocolFeeRecipient = new PublicKey(
		data.slice(offset, offset + 32),
	);
	offset += 32;

	const protocolFeeBps = readU16LE(data, offset);
	offset += 2;

	const creatorFeeBps = readU16LE(data, offset);
	offset += 2;

	const creationFee = readU64LE(data, offset);
	offset += 8;

	const graduationThreshold = readU64LE(data, offset);
	offset += 8;

	const tokenCount = readU64LE(data, offset);
	offset += 8;

	const isPaused = data[offset] !== 0;
	offset += 1;

	const bump = data[offset];

	return {
		owner,
		protocolFeeRecipient,
		protocolFeeBps,
		creatorFeeBps,
		creationFee,
		graduationThreshold,
		tokenCount,
		isPaused,
		bump,
	};
}

/**
 * Deserialize a BondingCurveState account (skips 8-byte Anchor discriminator)
 */
export function deserializeBondingCurveState(
	data: Uint8Array,
): BondingCurveData {
	let offset = 8; // Skip Anchor discriminator

	const tokenMint = new PublicKey(data.slice(offset, offset + 32));
	offset += 32;

	const factory = new PublicKey(data.slice(offset, offset + 32));
	offset += 32;

	const creator = new PublicKey(data.slice(offset, offset + 32));
	offset += 32;

	const totalSupply = readU64LE(data, offset);
	offset += 8;

	const reserveBalance = readU64LE(data, offset);
	offset += 8;

	const slope = readU64LE(data, offset);
	offset += 8;

	const basePrice = readU64LE(data, offset);
	offset += 8;

	const protocolFeeBps = readU16LE(data, offset);
	offset += 2;

	const creatorFeeBps = readU16LE(data, offset);
	offset += 2;

	const protocolFeeRecipient = new PublicKey(
		data.slice(offset, offset + 32),
	);
	offset += 32;

	const graduationThreshold = readU64LE(data, offset);
	offset += 8;

	const isGraduated = data[offset] !== 0;
	offset += 1;

	const isPaused = data[offset] !== 0;
	offset += 1;

	const bump = data[offset];

	return {
		tokenMint,
		factory,
		creator,
		totalSupply,
		reserveBalance,
		slope,
		basePrice,
		protocolFeeBps,
		creatorFeeBps,
		protocolFeeRecipient,
		graduationThreshold,
		isGraduated,
		isPaused,
		bump,
	};
}

// ─── Fetch Helpers ───────────────────────────────────────────────

/**
 * Fetch and deserialize the factory state from on-chain
 */
export async function fetchFactoryState(
	connection: Connection,
): Promise<FactoryStateData> {
	const [factoryPDA] = findFactoryStatePDA();
	const accountInfo = await connection.getAccountInfo(factoryPDA);

	if (!accountInfo) {
		throw new Error(
			"Factory state not found. The program may not be initialized.",
		);
	}

	return deserializeFactoryState(
		new Uint8Array(accountInfo.data),
	);
}

/**
 * Fetch and deserialize a bonding curve state from on-chain
 */
export async function fetchBondingCurveState(
	connection: Connection,
	bondingCurvePDA: PublicKey,
): Promise<BondingCurveData> {
	const accountInfo = await connection.getAccountInfo(bondingCurvePDA);

	if (!accountInfo) {
		throw new Error("Bonding curve state not found.");
	}

	return deserializeBondingCurveState(
		new Uint8Array(accountInfo.data),
	);
}

// ─── Instruction Builders ────────────────────────────────────────

/**
 * Build the create_token instruction data
 *
 * Layout: [8 discriminator][borsh string name][borsh string symbol]
 *         [borsh string image_uri][borsh string description]
 *         [u64 slope][u64 base_price]
 */
function buildCreateTokenData(
	name: string,
	symbol: string,
	imageUri: string,
	description: string,
	slope: bigint = DEFAULT_SLOPE,
	basePrice: bigint = DEFAULT_BASE_PRICE,
): Uint8Array {
	return concatBytes(
		DISCRIMINATORS.create_token,
		serializeBorshString(name),
		serializeBorshString(symbol),
		serializeBorshString(imageUri),
		serializeBorshString(description),
		serializeBorshU64(slope),
		serializeBorshU64(basePrice),
	);
}

/**
 * Build the buy_with_sol instruction data
 *
 * Layout: [8 discriminator][u64 sol_amount][u64 min_tokens_out]
 */
function buildBuyWithSolData(
	solAmount: bigint,
	minTokensOut: bigint,
): Uint8Array {
	return concatBytes(
		DISCRIMINATORS.buy_with_sol,
		serializeBorshU64(solAmount),
		serializeBorshU64(minTokensOut),
	);
}

/**
 * Build the sell instruction data
 *
 * Layout: [8 discriminator][u64 token_amount][u64 min_sol_out]
 */
function buildSellData(
	tokenAmount: bigint,
	minSolOut: bigint,
): Uint8Array {
	return concatBytes(
		DISCRIMINATORS.sell,
		serializeBorshU64(tokenAmount),
		serializeBorshU64(minSolOut),
	);
}

// ─── Transaction Builders ────────────────────────────────────────

export interface CreateTokenParams {
	/** Token name */
	name: string;
	/** Token symbol/ticker */
	symbol: string;
	/** URI for the token image/logo */
	imageUri: string;
	/** Token description */
	description: string;
	/** Bonding curve slope (defaults to DEFAULT_SLOPE) */
	slope?: bigint;
	/** Base price in lamports (defaults to DEFAULT_BASE_PRICE) */
	basePrice?: bigint;
}

export interface CreateTokenResult {
	/** The built transaction (partially signed with tokenMint keypair) */
	transaction: Transaction;
	/** The generated token mint keypair (needed as additional signer) */
	tokenMintKeypair: Keypair;
	/** The token mint public key */
	tokenMintAddress: PublicKey;
	/** The bonding curve PDA */
	bondingCurveAddress: PublicKey;
	/** The token info PDA */
	tokenInfoAddress: PublicKey;
}

/**
 * Build a create_token transaction
 *
 * The returned transaction is already partially signed with the tokenMint
 * keypair. The caller must have the user sign it via their wallet.
 */
export async function buildCreateTokenTransaction(
	connection: Connection,
	creator: PublicKey,
	params: CreateTokenParams,
): Promise<CreateTokenResult> {
	// Generate a new keypair for the token mint
	const tokenMintKeypair = Keypair.generate();
	const tokenMintPubkey = tokenMintKeypair.publicKey;

	// Derive PDAs
	const [factoryStatePDA] = findFactoryStatePDA();
	const [tokenInfoPDA] = findTokenInfoPDA(tokenMintPubkey);
	const [bondingCurvePDA] = findBondingCurvePDA(
		factoryStatePDA,
		tokenMintPubkey,
	);

	// Fetch factory state to get the fee recipient
	const factoryState = await fetchFactoryState(connection);
	const feeRecipient = factoryState.protocolFeeRecipient;

	// Build instruction data
	const data = buildCreateTokenData(
		params.name,
		params.symbol,
		params.imageUri,
		params.description,
		params.slope ?? DEFAULT_SLOPE,
		params.basePrice ?? DEFAULT_BASE_PRICE,
	);

	// Build the instruction
	const instruction = new TransactionInstruction({
		programId: HYPEMINT_PROGRAM_ID,
		keys: [
			{
				pubkey: factoryStatePDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: tokenMintPubkey,
				isSigner: true,
				isWritable: true,
			},
			{
				pubkey: tokenInfoPDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: bondingCurvePDA,
				isSigner: false,
				isWritable: true,
			},
			{ pubkey: creator, isSigner: true, isWritable: true },
			{
				pubkey: TOKEN_PROGRAM_ID,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: SystemProgram.programId,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: feeRecipient,
				isSigner: false,
				isWritable: true,
			},
		],
		data: Buffer.from(data),
	});

	// Build the transaction
	const transaction = new Transaction();
	const latestBlockhash = await connection.getLatestBlockhash("confirmed");
	transaction.recentBlockhash = latestBlockhash.blockhash;
	transaction.feePayer = creator;
	transaction.add(instruction);

	// Partially sign with the token mint keypair
	transaction.partialSign(tokenMintKeypair);

	return {
		transaction,
		tokenMintKeypair,
		tokenMintAddress: tokenMintPubkey,
		bondingCurveAddress: bondingCurvePDA,
		tokenInfoAddress: tokenInfoPDA,
	};
}

export interface BuyWithSolParams {
	/** The token mint public key */
	tokenMint: PublicKey;
	/** Amount of SOL to spend (in lamports) */
	solAmount: bigint;
	/** Minimum tokens to receive (slippage protection) */
	minTokensOut: bigint;
}

/**
 * Build a buy_with_sol transaction
 */
export async function buildBuyWithSolTransaction(
	connection: Connection,
	buyer: PublicKey,
	params: BuyWithSolParams,
): Promise<Transaction> {
	const [factoryStatePDA] = findFactoryStatePDA();
	const [bondingCurvePDA] = findBondingCurvePDA(
		factoryStatePDA,
		params.tokenMint,
	);
	const [curveVaultPDA] = findCurveVaultPDA(bondingCurvePDA);

	// Fetch bonding curve state to get fee recipients and creator
	const curveState = await fetchBondingCurveState(
		connection,
		bondingCurvePDA,
	);

	// Derive buyer's ATA for the token
	const buyerATA = findATA(buyer, params.tokenMint);

	// Check if buyer's ATA exists; if not, we need to create it
	const ataInfo = await connection.getAccountInfo(buyerATA);

	const transaction = new Transaction();

	if (!ataInfo) {
		// Create ATA instruction
		const createATAIx = createAssociatedTokenAccountInstruction(
			buyer, // payer
			buyerATA, // ATA address
			buyer, // owner
			params.tokenMint, // mint
		);
		transaction.add(createATAIx);
	}

	// Build buy instruction data
	const data = buildBuyWithSolData(
		params.solAmount,
		params.minTokensOut,
	);

	// Build the instruction
	const instruction = new TransactionInstruction({
		programId: HYPEMINT_PROGRAM_ID,
		keys: [
			{
				pubkey: bondingCurvePDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: params.tokenMint,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: buyerATA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveVaultPDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveState.protocolFeeRecipient,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveState.creator,
				isSigner: false,
				isWritable: true,
			},
			{ pubkey: buyer, isSigner: true, isWritable: true },
			{
				pubkey: TOKEN_PROGRAM_ID,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: SystemProgram.programId,
				isSigner: false,
				isWritable: false,
			},
		],
		data: Buffer.from(data),
	});

	transaction.add(instruction);

	const latestBlockhash = await connection.getLatestBlockhash("confirmed");
	transaction.recentBlockhash = latestBlockhash.blockhash;
	transaction.feePayer = buyer;

	return transaction;
}

export interface SellTokensParams {
	/** The token mint public key */
	tokenMint: PublicKey;
	/** Amount of tokens to sell (in smallest unit, with decimals) */
	tokenAmount: bigint;
	/** Minimum SOL to receive in lamports (slippage protection) */
	minSolOut: bigint;
}

/**
 * Build a sell transaction
 */
export async function buildSellTransaction(
	connection: Connection,
	seller: PublicKey,
	params: SellTokensParams,
): Promise<Transaction> {
	const [factoryStatePDA] = findFactoryStatePDA();
	const [bondingCurvePDA] = findBondingCurvePDA(
		factoryStatePDA,
		params.tokenMint,
	);
	const [curveVaultPDA] = findCurveVaultPDA(bondingCurvePDA);

	// Fetch bonding curve state
	const curveState = await fetchBondingCurveState(
		connection,
		bondingCurvePDA,
	);

	// Derive seller's ATA for the token
	const sellerATA = findATA(seller, params.tokenMint);

	// Build sell instruction data
	const data = buildSellData(params.tokenAmount, params.minSolOut);

	// Build the instruction
	const instruction = new TransactionInstruction({
		programId: HYPEMINT_PROGRAM_ID,
		keys: [
			{
				pubkey: bondingCurvePDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: params.tokenMint,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: sellerATA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveVaultPDA,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveState.protocolFeeRecipient,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: curveState.creator,
				isSigner: false,
				isWritable: true,
			},
			{ pubkey: seller, isSigner: true, isWritable: true },
			{
				pubkey: TOKEN_PROGRAM_ID,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: SystemProgram.programId,
				isSigner: false,
				isWritable: false,
			},
		],
		data: Buffer.from(data),
	});

	const transaction = new Transaction();
	transaction.add(instruction);

	const latestBlockhash = await connection.getLatestBlockhash("confirmed");
	transaction.recentBlockhash = latestBlockhash.blockhash;
	transaction.feePayer = seller;

	return transaction;
}

// ─── ATA Instruction Helper ─────────────────────────────────────

/**
 * Create an instruction to create an Associated Token Account
 * (manually built to avoid @solana/spl-token dependency)
 */
function createAssociatedTokenAccountInstruction(
	payer: PublicKey,
	ata: PublicKey,
	owner: PublicKey,
	mint: PublicKey,
): TransactionInstruction {
	return new TransactionInstruction({
		programId: ASSOCIATED_TOKEN_PROGRAM_ID,
		keys: [
			{ pubkey: payer, isSigner: true, isWritable: true },
			{ pubkey: ata, isSigner: false, isWritable: true },
			{ pubkey: owner, isSigner: false, isWritable: false },
			{ pubkey: mint, isSigner: false, isWritable: false },
			{
				pubkey: SystemProgram.programId,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: TOKEN_PROGRAM_ID,
				isSigner: false,
				isWritable: false,
			},
		],
		data: Buffer.from(new Uint8Array(0)),
	});
}

// ─── Utility: Get Solana Connection ──────────────────────────────

/**
 * Create a Solana connection.
 * When no rpcUrl is provided the backend RPC proxy is used so
 * private API keys never leave the server.
 */
export function getSolanaConnection(rpcUrl?: string | null): Connection {
	const url = rpcUrl || SOLANA_RPC_PROXY_URL;
	return new Connection(url, "confirmed");
}
