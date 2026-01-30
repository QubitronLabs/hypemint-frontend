// Token types based on API spec
export type TokenStatus =
	| "pending"
	| "active"
	| "graduated"
	| "failed"
	| "delisted";
export type TradeType = "buy" | "sell";
export type OrderBy = "createdAt" | "marketCap" | "volume24h";
export type OrderDir = "asc" | "desc";

export interface User {
	id: string;
	walletAddress: string;
	username?: string;
	displayName?: string;
	bio?: string;
	avatarUrl?: string;
	isVerified?: boolean;
	followersCount?: number;
	followingCount?: number;
	tokensCreated?: number;
	tradesCount?: number;
	createdAt: string;
	updatedAt?: string;
}

export interface Token {
	id: string;
	name: string;
	symbol: string;
	description?: string;
	imageUrl?: string;
	websiteUrl?: string;
	twitterUrl?: string;
	telegramUrl?: string;
	discordUrl?: string;
	totalSupply: string;
	circulatingSupply?: string;
	initialPrice: string;
	currentPrice: string;
	marketCap: string;
	volume24h: string;
	priceChange24h: number;
	priceChange5m?: string;
	priceChange1h?: string;
	priceChange6h?: string;
	chainId: number;
	status: TokenStatus;
	creatorId: string;
	creator?: User;
	contractAddress?: string;
	bondingCurveAddress?: string;
	bondingCurveProgress: number;
	graduationTarget: string;
	currentBondingAmount: string;
	holdersCount: number;
	tradesCount: number;
	hypeBoostEnabled?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface BondingCurve {
	id: string;
	tokenId: string;
	contractAddress: `0xe${string}`;
	curveType: "linear" | "exponential" | "sigmoid";
	initialPrice: string;
	slope: string;
	reserveRatio: number;
	currentSupply: string;
	currentReserve: string;
	currentPrice: string;
	graduationMarketCap: string;
	graduationSupply: string;
	isGraduated: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TokenListParams {
	page?: number;
	pageSize?: number;
	chainId?: number;
	status?: TokenStatus;
	orderBy?: OrderBy;
	orderDir?: OrderDir;
}

export interface CreateTokenInput {
	name: string;
	symbol: string;
	description?: string;
	imageUrl?: string;
	websiteUrl?: string;
	twitterUrl?: string;
	telegramUrl?: string;
	discordUrl?: string;
	totalSupply: string;
	initialPrice: string;
	chainId: number;
	contractAddress?: string; // On-chain contract address
	bondingCurveAddress?: string; // On-chain bonding curve address
	hypeBoostEnabled?: boolean; // Whether HypeBoost is enabled for enhanced visibility
}

export interface Trade {
	id: string;
	tokenId: string;
	token?: Token;
	userId: string;
	user?: User;
	type: TradeType;
	amount: string;
	price: string;
	totalValue: string;
	slippageTolerance: number;
	actualSlippage?: number;
	txHash?: string;
	blockNumber?: number;
	gasUsed?: string;
	status: "pending" | "confirmed" | "failed" | "cancelled";
	createdAt: string;
	confirmedAt?: string;
}

export interface TradeQuote {
	tokenId: string;
	type: TradeType;
	inputAmount: string;
	outputAmount: string;
	price: string;
	priceImpact: number;
	fee: string;
	minOutput: string;
	maxInput: string;
}

export interface CreateTradeInput {
	tokenId: string;
	type: TradeType;
	amount: string;
	slippageTolerance: number;
}

export interface ConfirmTradeInput {
	txHash: string;
	blockNumber: number;
	gasUsed: string;
	actualSlippage: number;
}

export interface TokenHolder {
	address: string;
	balance: string;
	percentage: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

// WebSocket event types
export interface PriceUpdate {
	tokenId: string;
	price: string;
	priceChange24h: number;
	marketCap: string;
	volume24h: string;
}

export interface TradeEvent {
	tokenId: string;
	trade?: Trade;
	txHash?: string;
	// Flattened fields from backend event
	tradeId?: string;
	userId?: string;
	username?: string;
	userAvatar?: string;
	type?: TradeType;
	amount?: string;
	price?: string;
	totalValue?: string;
	timestamp?: string;
	bondingCurveProgress?: number;
	marketCap?: string;
}

// Chain configuration
export interface ChainConfig {
	id: number;
	name: string;
	icon: string;
	nativeCurrency: {
		name: string;
		symbol: string;
		decimals: number;
	};
	explorerUrl: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
	{
		id: 1,
		name: "Ethereum",
		icon: "/chains/ethereum.svg",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		explorerUrl: "https://etherscan.io",
	},
	{
		id: 56,
		name: "BNB Chain",
		icon: "/chains/bnb.svg",
		nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
		explorerUrl: "https://bscscan.com",
	},
	{
		id: 8453,
		name: "Base",
		icon: "/chains/base.svg",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		explorerUrl: "https://basescan.org",
	},
	{
		id: 42161,
		name: "Arbitrum",
		icon: "/chains/arbitrum.svg",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		explorerUrl: "https://arbiscan.io",
	},
];
