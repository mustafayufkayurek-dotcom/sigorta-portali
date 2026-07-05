import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  persistTokens,
} from '@/utils/auth-session';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

export function getToken() {
  return getAccessToken();
}

export function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

export async function authAxios<T>(
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  const token = getAccessToken();
  const requestConfig: AxiosRequestConfig = {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${token}`,
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
      if (typeof window !== 'undefined') window.location.href = '/giris';
      throw error;
    }

    try {
      const refreshed = await axios.post(`${API}/auth/refresh`, { refreshToken });
      const tokens = refreshed.data?.data;
      if (tokens?.accessToken && tokens?.refreshToken) {
        persistTokens(tokens.accessToken, tokens.refreshToken);
        return await axios.request<T>({
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
      }
    } catch {
      /* refresh başarısız */
    }

    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/giris';
    throw error;
  }
}

import { fmtDate as fmtDateSafe } from '@/utils/date-helpers';

export function fmtDate(d: string | null | undefined) {
  return fmtDateSafe(d);
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

export function fmtCurrencyCompact(n: number | null | undefined) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return fmtCurrency(n);
}
