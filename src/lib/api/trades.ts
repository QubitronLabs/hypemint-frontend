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
    return data;
}

// Create pending trade
export async function createTrade(input: CreateTradeInput): Promise<Trade> {
    const { data } = await apiClient.post('/api/v1/trades/', input);
    return data;
}

// Confirm trade after blockchain confirmation
export async function confirmTrade(
    tradeId: string,
    input: ConfirmTradeInput
): Promise<Trade> {
    const { data } = await apiClient.post(`/api/v1/trades/${tradeId}/confirm`, input);
    return data;
}

// Get trades for a token
export async function getTokenTrades(tokenId: string): Promise<Trade[]> {
    const { data } = await apiClient.get(`/api/v1/trades/token/${tokenId}`);
    return data;
}
