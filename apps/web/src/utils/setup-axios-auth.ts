import {
  clearAuth,
  ensureValidSession,
  getAccessToken,
  getRefreshToken,
  sharedRefreshSession,
} from '@/utils/auth-session';
import { API } from '@/utils/api';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

let installed = false;

const PUBLIC_AUTH_PATH =
  /\/auth\/(login|forgot-password|reset-password|refresh|register)(\/|$|\?)/;

function isPublicAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATH.test(url);
}

type RetryConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

export function installAxiosAuthInterceptors(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  axios.interceptors.request.use(async (config) => {
    const url = config.url ?? '';
    if (isPublicAuthRequest(url)) return config;

    const method = (config.method ?? 'get').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      await ensureValidSession(API);
    }

    const token = getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (!config || config._authRetried || error.response?.status !== 401) {
        throw error;
      }
      if (isPublicAuthRequest(config.url)) throw error;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearAuth();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/giris')) {
          window.location.href = '/giris?reason=session_expired';
        }
        throw error;
      }

      config._authRetried = true;
      try {
        const ok = await sharedRefreshSession(API);
        if (ok) {
          const accessToken = getAccessToken();
          if (accessToken) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${accessToken}`;
            return axios.request(config);
          }
        }
      } catch {
        /* refresh başarısız */
      }

      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/giris')) {
        window.location.href = '/giris?reason=session_expired';
      }
      throw error;
    },
  );
}
