import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
});

// ─── Request Interceptor ─────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { accessToken, tenant } = useAuthStore.getState();

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (tenant?.id) {
        config.headers['X-Tenant-ID'] = tenant.id;
    }

    return config;
});

// ─── Response Interceptor ─────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null): void {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return apiClient(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const { refreshToken, logout, setAccessToken } = useAuthStore.getState();

            if (!refreshToken) {
                logout();
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(`${API_BASE_URL}/v1/auth/refresh`, { refreshToken });
                const { accessToken: newToken } = response.data.data;
                setAccessToken(newToken);
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                logout();
                toast.error('Session expired. Please login again.');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // Show error toast for non-401 errors
        if (error.response?.status !== 401) {
            const message =
                (error.response?.data as { message?: string })?.message ?? 'An unexpected error occurred';
            toast.error(Array.isArray(message) ? message[0] : message);
        }

        return Promise.reject(error);
    },
);

// ─── Typed helper to unwrap API envelope ─────────────────────────
export function unwrap<T>(response: { data: { data: T } }): T {
    return response.data.data;
}
