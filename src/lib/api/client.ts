import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>();

// Track if we're currently handling a logout to prevent multiple calls
let isHandlingLogout = false;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

/**
 * Force logout user and clear all auth state
 * This handles the case where JWT is expired but Dynamic session is stale
 */
export async function forceLogout(): Promise<void> {
  if (isHandlingLogout) return;
  isHandlingLogout = true;

  try {
    console.warn("[Auth] Force logout triggered - clearing all auth state");

    // Clear our auth store
    useAuthStore.getState().logout();

    // Clear localStorage auth data
    if (typeof window !== "undefined") {
      localStorage.removeItem("hypemint-auth");

      // Also clear Dynamic.xyz session data
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith("dynamic") || key.includes("wagmi"),
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    // Reload page to reset Dynamic.xyz state completely
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  } finally {
    isHandlingLogout = false;
  }
}

/**
 * Generate cache key for request deduplication
 */
function getRequestKey(config: InternalAxiosRequestConfig): string {
  return `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;
}

/**
 * Request interceptor - Adds JWT and handles deduplication
 */
apiClient.interceptors.request.use(
  (config) => {
    // Get JWT from Zustand store
    const jwt = useAuthStore.getState().jwt;

    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
      console.log("[API] Request with JWT:", config.url);
    } else {
      console.log("[API] Request WITHOUT JWT:", config.url);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Response interceptor - Handle auth errors and force logout on token expiry
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Handle 401 Unauthorized - force full logout
    if (error.response?.status === 401) {
      const errorData = error.response.data as any;
      const errorMessage =
        errorData?.error?.message || errorData?.message || "";

      // Check for token expiry or invalid token errors
      if (
        errorMessage.includes("expired") ||
        errorMessage.includes("Invalid") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("Unauthorized")
      ) {
        console.warn("[API] Token expired or invalid - forcing logout");
        await forceLogout();
      } else {
        // Generic 401 - just clear auth store
        console.warn("[API] 401 Unauthorized - Clearing auth");
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Deduplicated GET request
 * Prevents multiple identical GET requests from being made simultaneously
 */
export async function deduplicatedGet<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const key = `GET-${url}-${JSON.stringify(params || {})}`;

  // Check if request is already pending
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  // Make the request
  const promise = apiClient
    .get<T>(url, { params })
    .then((response) => {
      pendingRequests.delete(key);
      return response.data;
    })
    .catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });

  pendingRequests.set(key, promise);
  return promise;
}

export default apiClient;
