import apiClient from "./client";
import type {
  Trade,
  TradeQuote,
  CreateTradeInput,
  ConfirmTradeInput,
} from "@/types";

// Input type for recording on-chain trades
export interface RecordOnChainTradeInput {
  tokenId: string;
  bondingCurveAddress: string;
  type: "buy" | "sell";
  maticAmount: string;
  tokenAmount: string;
  txHash: string;
  blockNumber?: number;
}

// Get trade quote
export async function getTradeQuote(
  tokenId: string,
  type: "buy" | "sell",
  amount: string,
): Promise<TradeQuote> {
  const { data } = await apiClient.post("/api/v1/trades/quote", {
    tokenId,
    type,
    amount,
  });
  // Handle wrapped response
  return data.data ?? data;
}

// Create pending trade
export async function createTrade(input: CreateTradeInput): Promise<Trade> {
  const { data } = await apiClient.post("/api/v1/trades/", input);
  // Handle wrapped response
  return data.data ?? data;
}

// Record on-chain trade after blockchain confirmation
export async function recordOnChainTrade(
  input: RecordOnChainTradeInput,
): Promise<Trade> {
  const { data } = await apiClient.post("/api/v1/trades/onchain", input);
  // Handle wrapped response
  return data.data ?? data;
}

// Confirm trade after blockchain confirmation
export async function confirmTrade(
  tradeId: string,
  input: ConfirmTradeInput,
): Promise<Trade> {
  const { data } = await apiClient.post(
    `/api/v1/trades/${tradeId}/confirm`,
    input,
  );
  // Handle wrapped response
  return data.data ?? data;
}

// Get trades for a token
export async function getTokenTrades(tokenId: string): Promise<Trade[]> {
  const { data } = await apiClient.get(`/api/v1/trades/token/${tokenId}`);
  // Handle wrapped response - data might be { success, data: [...] } or just [...]
  const rawTrades = data.data ?? data;
  // Ensure we always return an array
  if (!Array.isArray(rawTrades)) return [];

  // Map backend trade format to frontend Trade interface
  return rawTrades.map((trade: any) => ({
    id: trade.id,
    tokenId: trade.tokenId,
    token: trade.token,
    userId: trade.userId,
    user: trade.user,
    type: trade.type,
    // Map backend fields to frontend fields
    amount: trade.tokenAmount || trade.amount || "0",
    price: trade.pricePerToken || trade.price || "0",
    totalValue: trade.ethAmount || trade.totalValue || "0",
    slippageTolerance: trade.slippageTolerance || 0,
    actualSlippage: trade.actualSlippage,
    txHash: trade.txHash,
    blockNumber: trade.blockNumber,
    gasUsed: trade.gasUsed,
    status: trade.status,
    createdAt: trade.createdAt,
    confirmedAt: trade.confirmedAt,
  }));
}

// Get trades for the current user
export async function getUserTrades(): Promise<Trade[]> {
  try {
    const { data } = await apiClient.get("/api/v1/trades/me");
    const rawTrades = data.data ?? data;
    if (!Array.isArray(rawTrades)) return [];

    // Map backend trade format to frontend Trade interface
    return rawTrades.map((trade: any) => ({
      id: trade.id,
      tokenId: trade.tokenId,
      token: trade.token,
      userId: trade.userId,
      user: trade.user,
      type: trade.type,
      // Map backend fields to frontend fields
      amount: trade.tokenAmount || trade.amount || "0",
      price: trade.pricePerToken || trade.price || "0",
      totalValue: trade.ethAmount || trade.totalValue || "0",
      slippageTolerance: trade.slippageTolerance || 0,
      actualSlippage: trade.actualSlippage,
      txHash: trade.txHash,
      blockNumber: trade.blockNumber,
      gasUsed: trade.gasUsed,
      status: trade.status,
      createdAt: trade.createdAt,
      confirmedAt: trade.confirmedAt,
    }));
  } catch (error) {
    // If endpoint doesn't exist, return empty array
    console.warn("getUserTrades: endpoint not available");
    return [];
  }
}
