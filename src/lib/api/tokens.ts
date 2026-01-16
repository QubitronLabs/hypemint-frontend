import apiClient from './client';
import type {
    Token,
    TokenListParams,
    CreateTokenInput,
    PaginatedResponse,
} from '@/types';

// List tokens with filters
export async function getTokens(params?: TokenListParams): Promise<PaginatedResponse<Token>> {
    const { data } = await apiClient.get('/api/v1/tokens/', { params });
    return data;
}

// Get trending tokens (sorted by 24h volume)
export async function getTrendingTokens(params?: Omit<TokenListParams, 'orderBy'>): Promise<PaginatedResponse<Token>> {
    const { data } = await apiClient.get('/api/v1/tokens/trending', { params });
    return data;
}

// Get new tokens (recently created)
export async function getNewTokens(params?: Omit<TokenListParams, 'orderBy'>): Promise<PaginatedResponse<Token>> {
    const { data } = await apiClient.get('/api/v1/tokens/new', { params });
    return data;
}

// Get token by ID
export async function getToken(id: string): Promise<Token> {
    const { data } = await apiClient.get(`/api/v1/tokens/${id}`);
    return data;
}

// Create new token
export async function createToken(input: CreateTokenInput): Promise<Token> {
    const { data } = await apiClient.post('/api/v1/tokens/', input);
    return data;
}
