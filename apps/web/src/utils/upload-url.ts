/** API tabanından statik upload kök URL'si (/api/v1 olmadan). */
export function getUploadsBaseUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const trimmed = apiBase.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed.slice(0, -'/api/v1'.length);
  }
  return trimmed.replace(/\/api\/v1\/?$/, '') || 'http://localhost:3000';
}

/** Onarım raporu fotoğrafları — Nest static /uploads/report-images/{key} */
export function getReportImageUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '';
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    return storageKey;
  }
  const key = storageKey.replace(/^\/+/, '');
  const path = key.startsWith('uploads/') ? key : `uploads/report-images/${encodeURIComponent(key)}`;
  return `${getUploadsBaseUrl()}/${path}`;
}
