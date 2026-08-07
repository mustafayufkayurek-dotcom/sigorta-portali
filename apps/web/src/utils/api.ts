import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  clearAuth,
  ensureValidSession,
  getAccessToken,
  getRefreshToken,
  sharedRefreshSession,
} from './auth-session';

export { ensureValidSession };

const _base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;

/** JWT access süresi 15 dk; panel açıkken periyodik yenileme aralığı */
export const SESSION_KEEPALIVE_MS = 10 * 60 * 1000;

export function getToken() {
  return getAccessToken();
}

export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** fetch() çağrıları için HeadersInit */
export function authFetchHeaders(extra?: HeadersInit): HeadersInit {
  const t = getToken();
  return {
    ...(extra ?? {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/** Kayıt/güncelleme öncesi oturumu yenile */
export async function ensureSessionBeforeMutation(): Promise<boolean> {
  const ok = await ensureValidSession(API);
  return ok && Boolean(getAccessToken());
}

/** Oturum süresi dolduğunda kullanıcıya gösterilecek standart mesaj */
export const SESSION_EXPIRED_USER_MESSAGE =
  'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.';

/** fetch() ile oturum korumalı istek — mutation öncesi yenileme + 401 retry */
export async function authFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureValidSession(API);
  }

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: HeadersInit = isFormData
    ? {
        ...(init.headers ?? {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      }
    : authFetchHeaders(init.headers);

  let response = await fetch(url, { ...init, headers });

  if (response.status === 401 && method !== 'GET' && method !== 'HEAD') {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const ok = await sharedRefreshSession(API);
        if (ok) {
          const accessToken = getAccessToken();
          if (accessToken) {
            response = await fetch(url, {
              ...init,
              headers: {
                ...headers,
                Authorization: `Bearer ${accessToken}`,
              },
            });
          }
        }
      } catch {
        /* refresh başarısız */
      }
    }
  }

  if (response.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/giris')) {
      window.location.href = '/giris?reason=session_expired';
    }
  }

  return response;
}

export async function authAxios<T>(
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  await ensureValidSession(API);

  const token = getAccessToken();
  const requestConfig: AxiosRequestConfig = {
    ...config,
    headers: {
      ...config.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  try {
    return await axios.request<T>(requestConfig);
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw error;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/giris?reason=session_expired';
      throw error;
    }

    try {
      const ok = await sharedRefreshSession(API);
      if (ok) {
        const accessToken = getAccessToken();
        return await axios.request<T>({
          ...config,
          headers: {
            ...config.headers,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
      }
    } catch {
      /* refresh başarısız */
    }

    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/giris?reason=session_expired';
    throw error;
  }
}
