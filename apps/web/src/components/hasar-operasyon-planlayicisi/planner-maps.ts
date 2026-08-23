/** Konum bağlantısı — adres veya kayıtlı URL. Personel ekranında harita markası yazılmaz. */

export function plannerMapsHref(
  locationUrl?: string | null,
  address?: string | null,
): string {
  const u = String(locationUrl ?? '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  const a = String(address ?? '').replace(/\s+/g, ' ').trim();
  if (!a || a === '—') return '';
  return `https://maps.google.com/?q=${encodeURIComponent(a)}`;
}

export function openPlannerMap(locationUrl?: string | null, address?: string | null) {
  const href = plannerMapsHref(locationUrl, address);
  if (!href || typeof window === 'undefined') return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
