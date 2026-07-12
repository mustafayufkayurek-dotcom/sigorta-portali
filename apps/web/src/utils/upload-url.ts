/** API tabanından statik upload kök URL'si (/api/v1 olmadan). */
export function getUploadsBaseUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const trimmed = apiBase.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed.slice(0, -'/api/v1'.length);
  }
  return trimmed.replace(/\/api\/v1\/?$/, '') || 'http://localhost:3000';
}

function buildReportImagePath(storageKey: string): string {
  const key = storageKey.replace(/^\/+/, '');
  if (key.startsWith('uploads/')) return key;
  const fileName = key.split('/').pop() ?? key;
  return `uploads/report-images/${encodeURIComponent(fileName)}`;
}

/** Onarım raporu fotoğrafları — nginx /uploads/ → backend static */
export function getReportImageUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '';
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    return storageKey;
  }
  const path = buildReportImagePath(storageKey);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/${path}`;
  }
  return `${getUploadsBaseUrl()}/${path}`;
}

/** JWT ile korumalı stream — doğrudan URL başarısız olursa galeri fallback */
export function getReportImageStreamUrl(imageId: string): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  return `${apiBase.replace(/\/$/, '')}/report-images/${imageId}/file`;
}
