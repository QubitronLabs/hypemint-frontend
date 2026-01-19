/**
 * User API Client
 *
 * Extended user API functions that are NOT already in auth.ts
 */

import { apiClient, deduplicatedGet } from './client';
import type { User, Token } from '@/types';

export interface PublicUser {
    id: string;
    walletAddress: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    isVerified: boolean;
    followersCount: number;
    followingCount: number;
    tokensCreated: number;
    tradesCount: number;
    createdAt: string;
}

export interface UserProfileResponse {
    user: PublicUser;
    isFollowing: boolean;
}

export interface FollowerUser {
    id: string;
    walletAddress: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    followersCount: number;
    followingCount: number;
}

/**
 * Get user profile by wallet address with isFollowing status
 * This is different from auth.ts getUser() as it includes isFollowing
 */
export async function getUserProfileByAddress(address: string): Promise<UserProfileResponse> {
    // deduplicatedGet returns T (the axios response.data), which is { success, data, error, meta }
    const response = await deduplicatedGet<{ success: boolean; data: UserProfileResponse; error: any }>(
        `/api/v1/users/${address}`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'User not found');
    }

    return response.data;
}

/**
 * Get tokens created by user
 */
export async function getUserCreatedTokens(
    userId: string,
    page = 1,
    pageSize = 20
): Promise<{ tokens: Token[]; total: number }> {
    const response = await apiClient.get<{ success: boolean; data: { tokens: Token[]; pagination: { total: number } } }>(
        `/api/v1/tokens`,
        { params: { creatorId: userId, page: String(page), pageSize: String(pageSize) } }
    );
    return {
        tokens: response.data.data.tokens || [],
        total: response.data.data.pagination?.total || 0,
    };
}

/**
 * Check if username is available (detailed response)
 * Note: auth.ts has checkUsernameAvailable which returns boolean
 * This one returns more details including the reason
 */
export async function checkUsernameAvailabilityDetailed(username: string): Promise<{
    available: boolean;
    reason: string | null;
}> {
    try {
        const response = await apiClient.get<{ success: boolean; data: { available: boolean; reason: string | null } }>(
            `/api/v1/users/check-username/${username.toLowerCase().trim()}`
        );
        return response.data.data;
    } catch (error) {
        console.error('Failed to check username:', error);
        return { available: true, reason: null };
    }
}
