import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>();

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

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
            console.log('[API] Request with JWT:', config.url);
        } else {
            console.log('[API] Request WITHOUT JWT:', config.url);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Response interceptor - Handle auth errors
 */
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            console.warn('[API] 401 Unauthorized - Clearing auth');
            useAuthStore.getState().logout();
        }

        return Promise.reject(error);
    }
);

/**
 * Deduplicated GET request
 * Prevents multiple identical GET requests from being made simultaneously
 */
export async function deduplicatedGet<T>(
    url: string,
    params?: Record<string, unknown>
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
