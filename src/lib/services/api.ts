import { browser } from "$app/environment";
import { get } from "svelte/store";
import { auth } from "$lib/stores/auth";

const API_BASE = "/api/v1";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  if (!browser) {
    return {
      success: false,
      error: { code: "SSR", message: "Cannot fetch on server" },
    };
  }

  try {
    const authState = get(auth);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (authState.token) {
      headers["Authorization"] = `Bearer ${authState.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || { code: "UNKNOWN", message: res.statusText },
      };
    }

    return { success: true, data: data.data || data };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "NETWORK", message: err.message || "Network error" },
    };
  }
}

export const api = {
  auth: {
    getNonce: (address: string) =>
      request<{ nonce: string; message: string; expiresAt: string }>(
        "/auth/nonce",
        {
          method: "POST",
          body: JSON.stringify({ walletAddress: address }),
        }
      ),

    verify: (data: {
      walletAddress: string;
      nonce: string;
      signature: string;
    }) =>
      request<{ token: string; user: any; expiresAt: string }>("/auth/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMe: () => request<any>("/auth/me"),

    logout: () => request("/auth/logout", { method: "POST" }),
  },

  tokens: {
    list: (params?: {
      page?: number;
      limit?: number;
      sort?: string;
      search?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.sort) query.set("sort", params.sort);
      if (params?.search) query.set("search", params.search);
      return request<any[]>(`/tokens?${query}`);
    },

    get: (id: string) => request<any>(`/tokens/${id}`),

    create: (data: any) =>
      request<any>("/tokens", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    trending: () => request<any[]>("/tokens/trending"),

    new: () => request<any[]>("/tokens/new"),

    getPrice: (id: string, amount: string, type: "buy" | "sell") =>
      request<{ price: string; slippage: string }>(
        `/tokens/${id}/price?amount=${amount}&type=${type}`
      ),
  },

  trades: {
    list: (params?: { page?: number; limit?: number; tokenId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.tokenId) query.set("tokenId", params.tokenId);
      return request<any[]>(`/trades?${query}`);
    },

    get: (id: string) => request<any>(`/trades/${id}`),

    create: (data: {
      tokenId: string;
      type: "buy" | "sell";
      amount: string;
      slippage?: number;
    }) =>
      request<any>("/trades", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    myTrades: (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      return request<any[]>(`/trades/me?${query}`);
    },
  },

  users: {
    get: (address: string) => request<any>(`/users/${address}`),

    update: (data: { username?: string; bio?: string; avatarUrl?: string }) =>
      request<any>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    getTokens: (address: string) => request<any[]>(`/users/${address}/tokens`),

    getTrades: (address: string) => request<any[]>(`/users/${address}/trades`),
  },
};
