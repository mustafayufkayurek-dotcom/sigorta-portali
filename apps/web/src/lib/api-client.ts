import {
  clearAuth,
  ensureValidSession,
  getAccessToken,
  getRefreshToken,
  sharedRefreshSession,
} from '@/utils/auth-session';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  meta?: unknown;
  message?: string;
};

function buildUrl(url: string, params?: QueryParams): string {
  const base = getBaseUrl().replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = `${base}${path}`;

  if (!params) return fullUrl;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${fullUrl}?${query}` : fullUrl;
}

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, init: RequestInit = {}, params?: QueryParams): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const apiBase = getBaseUrl().replace(/\/$/, '').replace(/\/api\/v1$/, '/api/v1');
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureValidSession(apiBase);
  }

  const isGet = method === 'GET';
  const finalUrl = isGet ? buildUrl(url, params) : buildUrl(url);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(init.headers ?? {}),
  };

  let response = await fetch(finalUrl, { ...init, headers });
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401 && method !== 'GET' && method !== 'HEAD') {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const ok = await sharedRefreshSession(apiBase);
        if (ok) {
          const accessToken = getAccessToken();
          if (accessToken) {
            response = await fetch(finalUrl, {
              ...init,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...(init.headers ?? {}),
              },
            });
            try {
              data = await response.json();
            } catch {
              data = null;
            }
          }
        }
      } catch {
        /* refresh başarısız */
      }
    }
  }

  // Axios / authFetch ile aynı oturum ölümü: refresh sonrası hâlâ 401 ise girişe yönlendir
  if (response.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/giris')) {
      window.location.href = '/giris?reason=session_expired';
    }
    throw new ApiError(401, 'Oturum süresi doldu. Lütfen tekrar giriş yapın.', data);
  }

  if (!response.ok) {
    const rawMessage =
      typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message?: unknown }).message
        : undefined;
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.filter((item): item is string => typeof item === 'string').join(', ')
          : response.statusText || 'API request failed';
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

// Unwrap NestJS { success, data } or legacy { data } envelopes
function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const envelope = raw as Record<string, unknown>;
    if (envelope.success === false) return raw as T;
    if (
      envelope.success === true ||
      Object.keys(envelope).every((key) => key === 'data' || key === 'meta')
    ) {
      return envelope.data as T;
    }
  }
  return raw as T;
}

function unwrapEnvelope<T>(raw: unknown): ApiEnvelope<T> {
  if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
    const envelope = raw as ApiEnvelope<T>;
    return {
      success: envelope.success,
      data: envelope.data,
      meta: envelope.meta,
      message: envelope.message,
    };
  }
  return { data: raw as T };
}

export const apiClient = {
  get: <T>(url: string, params?: QueryParams) => request<unknown>(url, { method: 'GET' }, params).then(r => unwrap<T>(r)),
  getWithMeta: <T, TMeta = unknown>(url: string, params?: QueryParams) =>
    request<unknown>(url, { method: 'GET' }, params).then((r) => unwrapEnvelope<T>(r) as ApiEnvelope<T> & { meta?: TMeta }),
  post: <T>(url: string, body?: unknown) =>
    request<unknown>(url, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }).then(r => unwrap<T>(r)),
  put: <T>(url: string, body?: unknown) =>
    request<unknown>(url, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }).then(r => unwrap<T>(r)),
  patch: <T>(url: string, body?: unknown) =>
    request<unknown>(url, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }).then(r => unwrap<T>(r)),
  delete: <T>(url: string) => request<unknown>(url, { method: 'DELETE' }).then(r => unwrap<T>(r)),
};