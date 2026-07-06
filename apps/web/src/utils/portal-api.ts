import { getAccessToken } from '@/utils/auth-session';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export const PORTAL_API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

/** Portal sayfaları — sessionStorage + localStorage uyumlu auth header */
export function getPortalAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function hasPortalSessionToken(): boolean {
  return Boolean(getAccessToken());
}

/** Sigorta / eksper bekleyen onaylar — JWT kapsamından filtrelenir */
export async function fetchPendingExternalApprovals(): Promise<unknown[]> {
  const res = await fetch(`${PORTAL_API}/external-approvals/pending`, {
    headers: getPortalAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  const body = await res.json();
  return body?.data ?? [];
}

/** Eksper bekleyen onaylar (geriye dönük uyumluluk) */
export async function fetchExpertPendingApprovals(expertUserId: string): Promise<unknown[]> {
  const res = await fetch(
    `${PORTAL_API}/external-approvals/pending?approverType=expert&approverId=${encodeURIComponent(expertUserId)}`,
    { headers: getPortalAuthHeaders() },
  );
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  const body = await res.json();
  return body?.data ?? [];
}

export async function fetchPortalClaimFiles(limit = 50): Promise<{ data: unknown[]; meta?: { total?: number } }> {
  if (!hasPortalSessionToken()) {
    throw new Error('SESSION_REQUIRED');
  }
  const res = await fetch(`${PORTAL_API}/claim-files?limit=${limit}`, {
    headers: getPortalAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  return res.json();
}

export async function fetchPortalInvoices(limit = 50): Promise<{ data: unknown[]; meta?: { total?: number } }> {
  if (!hasPortalSessionToken()) {
    throw new Error('SESSION_REQUIRED');
  }
  const res = await fetch(`${PORTAL_API}/invoices?limit=${limit}`, {
    headers: getPortalAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  return res.json();
}
