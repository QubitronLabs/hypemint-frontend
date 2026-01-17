import apiClient from './client';
import type {
    Trade,
    TradeQuote,
    CreateTradeInput,
    ConfirmTradeInput,
} from '@/types';

// Get trade quote
export async function getTradeQuote(
    tokenId: string,
    type: 'buy' | 'sell',
    amount: string
): Promise<TradeQuote> {
    const { data } = await apiClient.post('/api/v1/trades/quote', {
        tokenId,
        type,
        amount,
    });
    // Handle wrapped response
    return data.data ?? data;
}

// Create pending trade
export async function createTrade(input: CreateTradeInput): Promise<Trade> {
    const { data } = await apiClient.post('/api/v1/trades/', input);
    // Handle wrapped response
    return data.data ?? data;
}

// Confirm trade after blockchain confirmation
export async function confirmTrade(
    tradeId: string,
    input: ConfirmTradeInput
): Promise<Trade> {
    const { data } = await apiClient.post(`/api/v1/trades/${tradeId}/confirm`, input);
    // Handle wrapped response
    return data.data ?? data;
}

// Get trades for a token
export async function getTokenTrades(tokenId: string): Promise<Trade[]> {
    const { data } = await apiClient.get(`/api/v1/trades/token/${tokenId}`);
    // Handle wrapped response - data might be { success, data: [...] } or just [...]
    const trades = data.data ?? data;
    // Ensure we always return an array
    return Array.isArray(trades) ? trades : [];
}
