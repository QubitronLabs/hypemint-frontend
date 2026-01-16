import apiClient from './client';
import type { User } from '@/types';

interface AuthMeResponse {
    success: boolean;
    data: {
        user: User;
        dynamic: {
            dynamicUserId: string;
            email?: string;
            firstName?: string;
            lastName?: string;
        };
    };
    error?: {
        code: string;
        message: string;
        statusCode: number;
    };
    meta: {
        requestId: string;
        timestamp: string;
        version: string;
    };
}

interface RegisterResponse {
    success: boolean;
    data: {
        user: User;
    };
    error?: {
        code: string;
        message: string;
        statusCode: number;
    };
}

/**
 * Get current authenticated user
 * 
 * Uses JWT from Dynamic.xyz in Authorization header.
 * Returns user profile + Dynamic.xyz account details.
 */
export async function getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<AuthMeResponse>('/api/v1/auth/me');
    return data.data.user;
}

/**
 * Get current user with full response (including Dynamic.xyz info)
 */
export async function getAuthMe(): Promise<AuthMeResponse['data']> {
    const { data } = await apiClient.get<AuthMeResponse>('/api/v1/auth/me');
    return data.data;
}

/**
 * Register user with username
 * 
 * Called after wallet connection to set the username.
 * This is required before using most platform features.
 * 
 * @param username - Username (3-32 chars, alphanumeric + underscore)
 */
export async function registerUser(username: string): Promise<User> {
    const { data } = await apiClient.post<RegisterResponse>('/api/v1/auth/register', {
        username
    });
    return data.data.user;
}

/**
 * Check if username is available
 * 
 * Note: This can be done via register and catch 409 error,
 * or implement a dedicated endpoint if needed.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
    try {
        // For now, we'll assume available if no error
        // Backend should have a dedicated endpoint for this
        return true;
    } catch {
        return false;
    }
}

/**
 * Request nonce for legacy wallet signing (not needed with Dynamic.xyz)
 */
export async function requestNonce(walletAddress: string): Promise<{
    nonce: string;
    message: string;
    expiresAt: string;
}> {
    const { data } = await apiClient.post('/api/v1/auth/nonce', { walletAddress });
    return data.data;
}

// User endpoints
export async function getUser(address: string): Promise<User> {
    const { data } = await apiClient.get(`/api/v1/users/${address}`);
    return data.data?.user || data;
}

export async function getMyProfile(): Promise<User> {
    const { data } = await apiClient.get('/api/v1/users/me');
    return data.data?.user || data;
}

export async function updateMyProfile(input: {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
}): Promise<User> {
    const { data } = await apiClient.patch('/api/v1/users/me', input);
    return data.data?.user || data;
}

// Follow endpoints
export async function followUser(address: string): Promise<void> {
    await apiClient.post(`/api/v1/users/${address}/follow`);
}

export async function unfollowUser(address: string): Promise<void> {
    await apiClient.delete(`/api/v1/users/${address}/follow`);
}

export async function getUserFollowers(address: string, page = 1, pageSize = 20): Promise<{
    followers: User[];
    pagination: { page: number; pageSize: number; total: number };
}> {
    const { data } = await apiClient.get(`/api/v1/users/${address}/followers`, {
        params: { page, pageSize },
    });
    return data.data;
}

export async function getUserFollowing(address: string, page = 1, pageSize = 20): Promise<{
    following: User[];
    pagination: { page: number; pageSize: number; total: number };
}> {
    const { data } = await apiClient.get(`/api/v1/users/${address}/following`, {
        params: { page, pageSize },
    });
    return data.data;
}
