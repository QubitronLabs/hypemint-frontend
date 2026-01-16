import axios from 'axios';
import { useAuthStore } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.25:3000';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Request interceptor - Adds JWT from auth store to all requests
 * 
 * The JWT is obtained from Dynamic.xyz after wallet sign-in
 * and stored in Zustand (with localStorage persistence)
 */
apiClient.interceptors.request.use(
    (config) => {
        // Get JWT from Zustand store
        const jwt = useAuthStore.getState().jwt;

        if (jwt) {
            // Add as Bearer token per API spec
            config.headers.Authorization = `Bearer ${jwt}`;
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
    (error) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            console.warn('[API] 401 Unauthorized - Clearing auth');
            useAuthStore.getState().logout();
        }

        return Promise.reject(error);
    }
);

export default apiClient;
