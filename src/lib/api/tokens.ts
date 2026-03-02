import apiClient from "./client";
import type {
  Token,
  TokenListParams,
  CreateTokenInput,
  BondingCurve,
} from "@/types";

// Response wrapper type
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string; statusCode?: number } | null;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// Paginated result type
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// List tokens with filters (returns tokens + pagination metadata)
export async function getTokens(params?: TokenListParams): Promise<PaginatedResult<Token>> {
  const { data } = await apiClient.get<ApiResponse<Token[]>>(
    "/api/v1/tokens/",
    { params },
  );
  return {
    data: data.data ?? [],
    pagination: data.meta?.pagination ?? {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 40,
      totalItems: (data.data ?? []).length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

// Get trending tokens (sorted by 24h volume)
export async function getTrendingTokens(
  params?: Omit<TokenListParams, "orderBy">,
): Promise<Token[]> {
  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/trending",
      { params },
    );
    return data.data ?? [];
  } catch {
    // Fallback to regular tokens if trending endpoint doesn't exist
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/",
      {
        params: { ...params, orderBy: "volume24h" },
      },
    );
    return data.data ?? [];
  }
}

// Get new tokens (recently created)
export async function getNewTokens(
  params?: Omit<TokenListParams, "orderBy">,
): Promise<Token[]> {
  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/new",
      { params },
    );
    return data.data ?? [];
  } catch {
    // Fallback to regular tokens if new endpoint doesn't exist
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/",
      {
        params: { ...params, orderBy: "createdAt" },
      },
    );
    return data.data ?? [];
  }
}

// Get token by ID
export async function getToken(id: string): Promise<Token | null> {
  try {
    const { data } = await apiClient.get<
      ApiResponse<{ token: Token; bondingCurve: BondingCurve; nativeCurrency?: { symbol: string; decimals: number; chainName: string } }>
    >(`/api/v1/tokens/${id}`);

    if (!data.data) return null;

    const { token, bondingCurve, nativeCurrency } = data.data;
    const curve = bondingCurve || {};

    // Determine chain-specific divisors
    const isSolana = token.chainType === "SOLANA";
    // Token decimals: Solana = 9, EVM ERC20 = 18
    const tokenDecimalsDivisor = isSolana ? 1e9 : 1e18;
    // Native currency divisor: SOL = 1e9 (lamports), ETH/MATIC = 1e18 (wei)
    const nativeDivisor = isSolana ? 1e9 : 1e18;

    // Detect CPMM: bonding curve has virtual reserves set
    const isCPMM = curve.virtualNativeReserves && 
      curve.virtualTokenReserves && 
      BigInt(curve.virtualNativeReserves || "0") > 0n;

    let progress = 0;
    if (curve.isGraduated) {
      progress = 100;
    } else if (isCPMM && curve.graduationThresholdUsd && parseFloat(curve.graduationThresholdUsd) > 0) {
      // CPMM: Progress = (currentMcapUsd - initialMcapUsd) / (gradUsd - initialMcapUsd)
      // This ensures 0% at creation (seed buy only) and 100% at graduation
      const marketCapDecimal = parseFloat(token.marketCap || "0");
      const nativePrice = parseFloat(curve.nativePriceAtCreation || "0.1");
      const mcapUsd = marketCapDecimal * nativePrice;
      const gradUsd = parseFloat(curve.graduationThresholdUsd);
      const initMcapUsd = parseFloat(curve.initialMarketCapUsd || "0");
      const range = gradUsd - initMcapUsd;
      if (range > 0) {
        progress = ((mcapUsd - initMcapUsd) / range) * 100;
        progress = Math.min(99, Math.max(0, progress));
      }
    } else {
      // Legacy: reserve vs graduation threshold (both in native wei)
      const graduationThreshold = BigInt(
        curve.graduationMcap || curve.graduationMarketCap || curve.graduationThreshold || "0"
      );
      if (graduationThreshold > 0n) {
        const currentReserve = BigInt(curve.currentReserve || "0");
        progress = Number((currentReserve * 10000n) / graduationThreshold) / 100;
        progress = Math.min(99, Math.max(0, progress));
      } else {
        // Fallback: supply-based
        const graduationSupply = BigInt(
          curve.graduationSupply || (isSolana ? "1000000000000" : "1000000000000000000000000000"),
        );
        const currentSupplySafe = BigInt(curve.currentSupply || "0");
        if (graduationSupply > 0n) {
          progress = Number((currentSupplySafe * 10000n) / graduationSupply) / 100;
          progress = Math.min(99, Math.max(0, progress));
        }
      }
    }

    // Use token.currentPrice which is already converted to decimal by backend
    // Do NOT use curve.currentPrice which is in Wei format
    const currentPrice = token.currentPrice || "0";

    // Market cap is also already converted to decimal by backend
    const marketCap = token.marketCap || "0";

    // Volume24h is already converted to decimal by backend
    const volume24h = token.volume24h || "0";

    // Circulating supply is computed by backend from bonding curve data
    const circulatingSupplyDecimal = token.circulatingSupply || "800000000";

    // Convert bonding curve reserve from raw native units to human-readable
    // Subtract the platform's seed buy so it shows only user-contributed reserves
    let currentBondingAmountDecimal = "0";
    if (curve.currentReserve) {
      const currentReserveRaw = BigInt(curve.currentReserve);
      const seedBuyRaw = BigInt(curve.seedBuyAmount || "0");
      const userReserve = currentReserveRaw > seedBuyRaw ? currentReserveRaw - seedBuyRaw : 0n;
      currentBondingAmountDecimal = (Number(userReserve) / nativeDivisor).toString();
    }

    // Compute USD market cap: use backend-provided value or calculate from native mcap
    const nativePrice = parseFloat(curve.nativePriceAtCreation || "0");
    const marketCapUsd = token.marketCapUsd
      || (nativePrice > 0 ? (parseFloat(marketCap) * nativePrice).toFixed(2) : "0");

    // Compute USD price: use backend-provided value or calculate from native price
    const currentPriceUsd = token.currentPriceUsd
      || (nativePrice > 0 ? (parseFloat(currentPrice) * nativePrice).toFixed(18) : "0");

    // Graduation target: For CPMM use graduation mcap in native units, else legacy
    const graduationTarget = isCPMM
      ? (curve.graduationMcapNative || curve.graduationThresholdUsd || "0")
      : (curve.graduationMcap || curve.graduationMarketCap || "0");

    return {
      ...token,
      currentPrice,
      currentPriceUsd,
      marketCap,
      marketCapUsd,
      volume24h,
      circulatingSupply: circulatingSupplyDecimal,
      bondingCurveAddress: curve.contractAddress || undefined,
      bondingCurveProgress: progress,
      graduationTarget,
      currentBondingAmount: currentBondingAmountDecimal,
      // USD-based values for bonding curve progress display
      graduationThresholdUsd: curve.graduationThresholdUsd ? Number(curve.graduationThresholdUsd) : null,
      initialMarketCapUsd: curve.initialMarketCapUsd ? Number(curve.initialMarketCapUsd) : null,
      nativePriceAtCreation: curve.nativePriceAtCreation || null,
      isGraduated: curve.isGraduated || false,
      holdersCount: token.holdersCount || 0,
      tradesCount: token.tradesCount || 0,
      description: token.description || "",
      imageUrl: token.imageUrl || "",
      websiteUrl: token.websiteUrl || "",
      twitterUrl: token.twitterUrl || "",
      telegramUrl: token.telegramUrl || "",
      discordUrl: token.discordUrl || "",
      nativeCurrency: nativeCurrency || undefined,
    };
  } catch (err) {
    console.error("Failed to get token detail:", err);
    return null;
  }
}

// Create new token
export async function createToken(input: CreateTokenInput): Promise<Token> {
  const { data } = await apiClient.post<
    ApiResponse<{ token: Token; bondingCurve: BondingCurve }>
  >("/api/v1/tokens/", input);
  // Handle both wrapped { token, bondingCurve } and direct token response
  const responseData = data.data;
  if (responseData && "token" in responseData) {
    return responseData.token;
  }
  return responseData;
}

// ============================================================
//  Gasless Token Creation (backend custom-signing)
// ============================================================

export interface CreateTokenRequestInput {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  hypeBoostEnabled?: boolean;
  slope?: string;
  basePrice?: string;
  chainId?: number;
}

export interface CreateTokenRequestResult {
  token: Token;
  bondingCurve: BondingCurve;
  txHash: string;
}

/**
 * Request gasless token creation via backend custom signing.
 * The backend signs and submits the transaction — user pays zero gas.
 *
 * Returns the created token, bonding curve, and tx hash synchronously.
 */
export async function createTokenRequest(
  input: CreateTokenRequestInput,
): Promise<CreateTokenRequestResult> {
  const { data } = await apiClient.post<ApiResponse<CreateTokenRequestResult>>(
    "/api/v1/tokens/create-gasless",
    input,
  );
  if (!data.success || !data.data) {
    const msg = data.error?.message || "Token creation failed";
    throw new Error(msg);
  }
  return data.data;
}

// Check if token symbol is available
export async function checkTokenSymbol(
  symbol: string,
  chainId?: number,
): Promise<{
  available: boolean;
  reason: string | null;
  symbol: string;
}> {
  try {
    const params = chainId ? { chainId: String(chainId) } : {};
    const { data } = await apiClient.get<
      ApiResponse<{
        available: boolean;
        reason: string | null;
        symbol: string;
      }>
    >(`/api/v1/tokens/check-symbol/${symbol.toUpperCase()}`, { params });
    return data.data;
  } catch (error) {
    console.error("Failed to check symbol:", error);
    return { available: true, reason: null, symbol: symbol.toUpperCase() };
  }
}

// Search user result type
export interface SearchUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string;
  isVerified: boolean;
  followersCount: number;
  tokensCreated: number;
}

// Search results containing both tokens and users
export interface SearchResults {
  tokens: Token[];
  users: SearchUser[];
}

// Search tokens and users
export async function searchTokens(
  query: string,
  options?: { chainId?: number; limit?: number },
): Promise<SearchResults> {
  if (!query || query.length < 2) return { tokens: [], users: [] };

  try {
    const { data } = await apiClient.get<ApiResponse<SearchResults>>(
      "/api/v1/tokens/search",
      {
        params: {
          q: query,
          chainId: options?.chainId ? String(options.chainId) : undefined,
          limit: options?.limit ? String(options.limit) : undefined,
        },
      },
    );
    return data.data ?? { tokens: [], users: [] };
  } catch (error) {
    console.error("Failed to search tokens:", error);
    return { tokens: [], users: [] };
  }
}

// Get live tokens (actively trading)
export async function getLiveTokens(options?: {
  chainId?: number;
  limit?: number;
}): Promise<Token[]> {
  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/live",
      {
        params: {
          chainId: options?.chainId ? String(options.chainId) : undefined,
          limit: options?.limit ? String(options.limit) : undefined,
        },
      },
    );
    return data.data ?? [];
  } catch (error) {
    console.error("Failed to get live tokens:", error);
    return [];
  }
}

// Get graduated tokens
export async function getGraduatedTokens(options?: {
  chainId?: number;
  limit?: number;
}): Promise<Token[]> {
  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/graduated",
      {
        params: {
          chainId: options?.chainId ? String(options.chainId) : undefined,
          limit: options?.limit ? String(options.limit) : undefined,
        },
      },
    );
    return data.data ?? [];
  } catch (error) {
    console.error("Failed to get graduated tokens:", error);
    return [];
  }
}

// Get user's created tokens (requires auth)
export async function getMyTokens(): Promise<Token[]> {
  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/my-tokens",
    );
    return data.data ?? [];
  } catch (error) {
    console.error("Failed to get my tokens:", error);
    return [];
  }
}

// Sync token with blockchain
export async function syncTokenWithBlockchain(tokenId: string): Promise<{
  synced: boolean;
  message?: string;
  bondingCurveState?: {
    reserveBalance: string;
    currentSupply: string;
    currentPrice: string;
    graduated: boolean;
    graduationThreshold: string;
  };
  holdersCount?: number;
  marketCap?: string;
}> {
  try {
    const { data } = await apiClient.post<
		ApiResponse<{
			synced: boolean;
			message?: string;
			bondingCurveState?: {
				reserveBalance: string;
				currentSupply: string;
				currentPrice: string;
				graduated: boolean;
				graduationThreshold: string;
			};
			holdersCount?: number;
			marketCap?: string;
		}>
	>(`/api/v1/tokens/${tokenId}/sync`);
    return data.data;
  } catch (error) {
    console.error("Failed to sync token:", error);
    return { synced: false, message: "Failed to sync with blockchain" };
  }
}

// Get on-chain token balance for a wallet
export async function getWalletTokenBalance(
  tokenId: string,
  walletAddress: string,
): Promise<{
  balance: string;
  balanceFormatted: number;
  message?: string;
}> {
  try {
    const { data } = await apiClient.get<
      ApiResponse<{
        balance: string;
        balanceFormatted: number;
        message?: string;
      }>
    >(`/api/v1/tokens/${tokenId}/balance`, {
      params: { walletAddress },
    });
    return data.data;
  } catch (error) {
    console.error("Failed to get wallet balance:", error);
    return { balance: "0", balanceFormatted: 0 };
  }
}

// Token holder type
export interface TokenHolder {
  address: string;
  balance: string;
  balanceFormatted: number;
  percentage: number;
}

// Get token holders from blockchain
export async function getTokenHolders(tokenId: string): Promise<{
  holders: TokenHolder[];
  totalHolders: number;
  message?: string;
}> {
  try {
    const { data } = await apiClient.get<
      ApiResponse<{
        holders: TokenHolder[];
        totalHolders: number;
        message?: string;
      }>
    >(`/api/v1/tokens/${tokenId}/holders`);
    return data.data;
  } catch (error) {
    console.error("Failed to get token holders:", error);
    return { holders: [], totalHolders: 0 };
  }
}

// Get initial supply preview for token creation
export interface InitialSupplyPreview {
  maticAmount: number;
  estimatedTokens: number;
  estimatedTokensFormatted: string;
  startingPrice: number;
  startingPriceFormatted: string;
  fees: number;
  feesFormatted: string;
  note: string;
}

export async function getInitialSupplyPreview(
  maticAmount: string,
  chainId?: number,
): Promise<InitialSupplyPreview | null> {
  try {
    const params: Record<string, string> = { amount: maticAmount };
    if (chainId) params.chainId = chainId.toString();
    const { data } = await apiClient.get<ApiResponse<InitialSupplyPreview>>(
      `/api/v1/config/initial-supply-preview`,
      { params },
    );
    return data.data;
  } catch (error) {
    console.error("Failed to get initial supply preview:", error);
    return null;
  }
}

// Get platform fees configuration
export interface PlatformFees {
  protocolFee: string;
  creatorFee: string;
  totalTradeFee: string;
  creationFee: string;
  graduationFee: string;
}

export async function getPlatformFees(): Promise<PlatformFees | null> {
  try {
    const { data } =
      await apiClient.get<ApiResponse<PlatformFees>>(`/api/v1/config/fees`);
    return data.data;
  } catch (error) {
    console.error("Failed to get platform fees:", error);
    return null;
  }
}

// Get buy quote for a token
export interface BuyQuote {
  tokenAmount: string;
  tokenAmountFormatted: number;
  protocolFee: string;
  creatorFee: string;
  totalFees: string;
  totalFeesFormatted: number;
  effectivePrice: number;
  priceImpact: number;
  maticAmount: string;
  tokenSymbol?: string;
}

export async function getBuyQuote(
  tokenId: string,
  maticAmount: string,
): Promise<BuyQuote | null> {
  try {
    const { data } = await apiClient.get<ApiResponse<BuyQuote>>(
      `/api/v1/tokens/${tokenId}/quote/buy`,
      { params: { amount: maticAmount } },
    );
    return data.data;
  } catch (error) {
    console.error("Failed to get buy quote:", error);
    return null;
  }
}

// Get CPMM tokenomics for a specific chain (live preview values)
export interface ChainTokenomics {
  totalSupply: number;
  lpReserveTokens: number;
  curveSupply: number;
  internalBuyTokens: number;
  graduationMultiplier: number;
  initialPriceUsd?: number;
  initialPriceNative?: number;
  initialMcapUsd?: number;
  graduationThresholdUsd?: number;
  nativePriceUsd?: number;
  nativeSymbol?: string;
  seedBuyCostNative?: string;
}

export async function getChainTokenomics(
  chainId: number,
): Promise<ChainTokenomics | null> {
  try {
    const { data } = await apiClient.get<ApiResponse<ChainTokenomics>>(
      `/api/v1/config/tokenomics`,
      { params: { chainId: chainId.toString() } },
    );
    return data.data;
  } catch (error) {
    console.error("Failed to get chain tokenomics:", error);
    return null;
  }
}
