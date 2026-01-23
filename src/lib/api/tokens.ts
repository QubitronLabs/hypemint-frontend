import apiClient from "./client";
import type { Token, TokenListParams, CreateTokenInput } from "@/types";

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

    let progress = 0;
    if (curve.isGraduated) {
      progress = 100;
    } else if (graduationSupply > 0n) {
      // Calculate percentage safely
      const p = Number((currentSupply * 10000n) / graduationSupply) / 100;
      progress = Math.min(99, Math.max(0, p));
    }

    const currentPrice = curve.currentPrice || token.currentPrice || "0";

    // Calculate market cap if not provided
    let marketCap = token.marketCap;
    if ((!marketCap || marketCap === "0") && currentPrice && currentSupply) {
      marketCap = (
        (BigInt(currentPrice) * currentSupply) /
        BigInt(1e18)
      ).toString();
    }

    return {
      ...token,
      currentPrice,
      marketCap: marketCap || "0",
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
    ApiResponse<{ token: Token; bondingCurve: any }>
  >("/api/v1/tokens/", input);
  // Handle both wrapped { token, bondingCurve } and direct token response
  const responseData = data.data;
  if (responseData && "token" in responseData) {
    return responseData.token;
  }
  return responseData as unknown as Token;
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
      ApiResponse<{ available: boolean; reason: string | null; symbol: string }>
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
