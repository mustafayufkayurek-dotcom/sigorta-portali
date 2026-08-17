import { authFetch, API } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';

export const PORTAL_API = API;

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
  const res = await authFetch(`${PORTAL_API}/external-approvals/pending`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  const body = await res.json();
  return body?.data ?? [];
}

/** Eksper bekleyen onaylar (geriye dönük uyumluluk) */
export async function fetchExpertPendingApprovals(expertUserId: string): Promise<unknown[]> {
  const res = await authFetch(
    `${PORTAL_API}/external-approvals/pending?approverType=expert&approverId=${encodeURIComponent(expertUserId)}`,
    { headers: { 'Content-Type': 'application/json' } },
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
  const res = await authFetch(`${PORTAL_API}/claim-files?limit=${limit}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  return res.json();
}

/** Asistans portalı — acil yardım dosyaları (kapsam JWT’den) */
export async function fetchPortalEmergencyCases(limit = 100): Promise<{ data: unknown[] }> {
  if (!hasPortalSessionToken()) {
    throw new Error('SESSION_REQUIRED');
  }
  const res = await authFetch(`${PORTAL_API}/emergency/cases?limit=${limit}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  const body = await res.json();
  const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return { data };
}

/** Ayarlar → Dosya Konuları (acil) — asistans portalı etiket eşlemesi */
export async function fetchAcilDosyaKonusuCatalog(): Promise<string[]> {
  if (!hasPortalSessionToken()) {
    throw new Error('SESSION_REQUIRED');
  }
  const res = await authFetch(`${PORTAL_API}/system-settings/ihbar-konulari`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  const body = await res.json();
  const payload = (body?.data ?? body) as { hasar?: string[]; acil?: string[] } | null;
  return (payload?.acil ?? []).filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  );
}

export async function fetchPortalInvoices(limit = 50): Promise<{ data: unknown[]; meta?: { total?: number } }> {
  if (!hasPortalSessionToken()) {
    throw new Error('SESSION_REQUIRED');
  }
  const res = await authFetch(`${PORTAL_API}/invoices?limit=${limit}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Sunucu hatası: ${res.status}`);
  }
  return res.json();
}

/**
 * Asistans portal faturaları — kapsamlı acil yardım dosyalarından
 * (ClaimFile /invoices değil; FATURALANDILDI veya fatura tarihi olan kayıtlar).
 */
export async function fetchPortalEmergencyBillingRows(limit = 100): Promise<{
  data: Array<{
    id: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate?: string | null;
    totalAmount: number;
    status: string;
    caseId: string;
    fileNo: string;
  }>;
}> {
  const { data } = await fetchPortalEmergencyCases(limit);
  const rows = (data ?? [])
    .map((raw: any) => {
      const status = String(raw.status || '').toUpperCase();
      const invoicedAt = raw.invoicedAt || null;
      const totalGelir = typeof raw.totalGelir === 'number' ? raw.totalGelir : 0;
      const isBilled = status === 'FATURALANDILDI' || Boolean(invoicedAt);
      if (!isBilled && !(status === 'COZULDU' && totalGelir > 0)) return null;
      const fileNo = String(raw.fileNo || raw.caseNo || '—');
      const invoiceNo =
        (raw.invoiceDraft && (raw.invoiceDraft.draftNo || raw.invoiceDraft.invoiceNo)) ||
        fileNo;
      return {
        id: String(raw.id),
        invoiceNo: String(invoiceNo),
        invoiceDate: String(invoicedAt || raw.resolvedAt || raw.fileDate || raw.createdAt || ''),
        dueDate: null as string | null,
        totalAmount: totalGelir,
        status: isBilled ? 'FATURALANDILDI' : status,
        caseId: String(raw.id),
        fileNo,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return { data: rows };
}
