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

// List tokens with filters
export async function getTokens(params?: TokenListParams): Promise<Token[]> {
  const { data } = await apiClient.get<ApiResponse<Token[]>>(
    "/api/v1/tokens/",
    { params },
  );
  return data.data ?? [];
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
      ApiResponse<{ token: Token; bondingCurve: any }>
    >(`/api/v1/tokens/${id}`);

    if (!data.data) return null;

    const { token, bondingCurve } = data.data;
    const curve = bondingCurve || {};

    const currentSupply = BigInt(
      curve.currentSupply || token.totalSupply || "0",
    );
    const graduationSupply = BigInt(
      curve.graduationSupply || "1000000000000000000000000000",
    ); // ~1B tokens default

    const graduationThreshold = BigInt(
      curve.graduationThreshold || curve.graduationMarketCap || "69000000000000000000000" // 69k * 1e18
    ); 

    let progress = 0;
    if (curve.isGraduated) {
      progress = 100;
    } else {
      // Calculate based on Market Cap (preferred) or Supply as backup
      // Backend provides token.marketCap as DECIMAL string
      // graduationThreshold is WEI string
      
      const marketCapDecimal = parseFloat(token.marketCap || "0");
      const graduationThresholdDecimal = Number(graduationThreshold) / 1e18;

      if (graduationThresholdDecimal > 0) {
        progress = (marketCapDecimal / graduationThresholdDecimal) * 100;
      } else if (graduationSupply > 0n) {
        // Backup: Supply-based
        const currentSupplySafe = BigInt(curve.currentSupply || "0");
        progress = Number((currentSupplySafe * 10000n) / graduationSupply) / 100;
      }
      
      progress = Math.min(99, Math.max(0, progress));
    }

    // Use token.currentPrice which is already converted to decimal by backend
    // Do NOT use curve.currentPrice which is in Wei format
    const currentPrice = token.currentPrice || "0";

    // Market cap is also already converted to decimal by backend
    const marketCap = token.marketCap || "0";

    // Volume24h is already converted to decimal by backend
    const volume24h = token.volume24h || "0";

    // Convert circulatingSupply from Wei to decimal
    const circulatingSupplyDecimal = curve.currentSupply 
      ? (Number(BigInt(curve.currentSupply)) / 1e18).toString()
      : "0";

    return {
      ...token,
      currentPrice,
      marketCap,
      volume24h,
      circulatingSupply: circulatingSupplyDecimal,
      bondingCurveAddress: curve.contractAddress || undefined,
      bondingCurveProgress: progress,
      graduationTarget: curve.graduationMarketCap || "69000", // Default target
      currentBondingAmount: curve.currentReserve || "0",
      holdersCount: token.holdersCount || 0,
      tradesCount: token.tradesCount || 0,
      description: token.description || "",
      imageUrl: token.imageUrl || "",
      websiteUrl: token.websiteUrl || "",
      twitterUrl: token.twitterUrl || "",
      telegramUrl: token.telegramUrl || "",
      discordUrl: token.discordUrl || "",
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

// Search tokens by name or symbol
export async function searchTokens(
  query: string,
  options?: { chainId?: number; limit?: number },
): Promise<Token[]> {
  if (!query || query.length < 2) return [];

  try {
    const { data } = await apiClient.get<ApiResponse<Token[]>>(
      "/api/v1/tokens/search",
      {
        params: {
          q: query,
          chainId: options?.chainId ? String(options.chainId) : undefined,
          limit: options?.limit ? String(options.limit) : undefined,
        },
      },
    );
    return data.data ?? [];
  } catch (error) {
    console.error("Failed to search tokens:", error);
    return [];
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
        bondingCurveState?: any;
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
): Promise<InitialSupplyPreview | null> {
  try {
    const { data } = await apiClient.get<ApiResponse<InitialSupplyPreview>>(
      `/api/v1/config/initial-supply-preview`,
      { params: { amount: maticAmount } },
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
