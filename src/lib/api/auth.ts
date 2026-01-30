import apiClient, { deduplicatedGet } from "./client";
import type { User, FollowUserResponse, UnfollowUserResponse } from "@/types";

// ==============================
// Types
// ==============================

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

// ==============================
// Auth Endpoints
// ==============================

/**
 * Get current authenticated user (DEDUPLICATED)
 *
 * Uses JWT from Dynamic.xyz in Authorization header.
 * This endpoint is deduplicated to prevent multiple calls.
 */
export async function getCurrentUser(): Promise<User> {
	const response = await deduplicatedGet<AuthMeResponse>("/api/v1/auth/me");
	return response.data.user;
}

/**
 * Get current user with full response (including Dynamic.xyz info)
 * DEDUPLICATED version
 */
export async function getAuthMe(): Promise<AuthMeResponse["data"]> {
	const response = await deduplicatedGet<AuthMeResponse>("/api/v1/auth/me");
	return response.data;
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
	const { data } = await apiClient.post<RegisterResponse>(
		"/api/v1/auth/register",
		{
			username,
		},
	);
	return data.data.user;
}

/**
 * Update current user's username
 */
export async function updateUsername(username: string): Promise<User> {
	const { data } = await apiClient.patch<RegisterResponse>(
		"/api/v1/users/me",
		{
			username,
		},
	);
	return data.data.user;
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailable(
	username: string,
): Promise<boolean> {
	try {
		const { data } = await apiClient.get<{ available: boolean }>(
			`/api/v1/auth/check-username/${username}`,
		);
		return data.available;
	} catch {
		// If endpoint doesn't exist, assume available
		return true;
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
	const { data } = await apiClient.post("/api/v1/auth/nonce", {
		walletAddress,
	});
	return data.data;
}

// ==============================
// User Endpoints
// ==============================

export async function getUser(address: string): Promise<User> {
	const { data } = await apiClient.get(`/api/v1/users/${address}`);
	return data.data?.user || data;
}

export async function getMyProfile(): Promise<User> {
	const { data } = await apiClient.get("/api/v1/users/me");
	return data.data?.user || data;
}

export async function updateMyProfile(input: {
	username?: string;
	displayName?: string;
	bio?: string;
	avatarUrl?: string;
}): Promise<User> {
	const { data } = await apiClient.patch("/api/v1/users/me", input);
	return data.data?.user || data;
}

// ==============================
// Follow Endpoints
// ==============================

// Re-export types from @/types for convenience

/**
 * Follow a user
 * @param address - The wallet address of the user to follow
 * @returns FollowUserResponse with success message and updated user data
 */
export async function followUser(address: string): Promise<FollowUserResponse> {
	const { data } = await apiClient.post(`/api/v1/users/${address}/follow`);
	return data.data;
}

/**
 * Unfollow a user
 * @param address - The wallet address of the user to unfollow
 * @returns UnfollowUserResponse with success message and updated user data
 */
export async function unfollowUser(
	address: string,
): Promise<UnfollowUserResponse> {
	const { data } = await apiClient.delete(`/api/v1/users/${address}/follow`);
	return data.data;
}

export async function getUserFollowers(
	address: string,
	page = 1,
	pageSize = 20,
): Promise<{
	followers: User[];
	pagination: { page: number; pageSize: number; total: number };
}> {
	const { data } = await apiClient.get(`/api/v1/users/${address}/followers`, {
		params: { page, pageSize },
	});
	return data.data;
}

export async function getUserFollowing(
	address: string,
	page = 1,
	pageSize = 20,
): Promise<{
	following: User[];
	pagination: { page: number; pageSize: number; total: number };
}> {
	const { data } = await apiClient.get(`/api/v1/users/${address}/following`, {
		params: { page, pageSize },
	});
	return data.data;
}
