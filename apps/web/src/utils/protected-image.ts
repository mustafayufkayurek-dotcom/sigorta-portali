import { API, authHeader, ensureValidSession } from '@/utils/api';

const STREAM_RETRY_DELAYS_MS = [0, 400, 1200];

function isJsonBlob(blob: Blob): boolean {
  return Boolean(blob.type && blob.type.includes('json'));
}

/**
 * JWT ile API üzerinden resim baytı. 302 imzalı URL (MinIO) takip edilmez —
 * tarayıcı yetki başlığını S3’e taşıyınca kutu boş kalıyordu.
 */
export async function fetchAuthImageBlob(url: string): Promise<Blob | null> {
  for (const delay of STREAM_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      await ensureValidSession(API);
      const res = await fetch(url, {
        headers: { ...authHeader(), Accept: 'image/*,*/*' },
        cache: 'no-store',
        credentials: 'include',
        redirect: 'manual',
      });
      if (res.status === 404) return null;
      if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        await ensureValidSession(API);
        continue;
      }
      if (!res.ok) continue;
      const blob = await res.blob();
      if (isJsonBlob(blob)) continue;
      if (blob.size < 32) continue;
      return blob;
    } catch {
      /* sonraki deneme */
    }
  }
  return null;
}

export function entityDocumentFileUrl(id: string, variant: 'thumb' | 'full' = 'thumb'): string {
  const q = variant === 'thumb' ? '?variant=thumb' : '';
  return `${API}/entity-documents/${id}/file${q}`;
}

export function vendorDocumentFileUrl(id: string, variant: 'thumb' | 'full' = 'thumb'): string {
  const q = variant === 'thumb' ? '?variant=thumb' : '';
  return `${API}/vendor-documents/${id}/file${q}`;
}

export function uploadsFileUrl(storageKey: string): string {
  return `${API}/uploads/file?storageKey=${encodeURIComponent(storageKey)}`;
}
