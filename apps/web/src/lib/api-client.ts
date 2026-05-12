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
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, init: RequestInit = {}, params?: QueryParams): Promise<T> {
  const isGet = (init.method ?? 'GET').toUpperCase() === 'GET';
  const finalUrl = isGet ? buildUrl(url, params) : buildUrl(url);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(init.headers ?? {}),
  };

  const response = await fetch(finalUrl, { ...init, headers });
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : response.statusText) || 'API request failed';
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

// Unwrap NestJS { success, data } wrapper if present
function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
    return (raw as { data: T }).data;
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