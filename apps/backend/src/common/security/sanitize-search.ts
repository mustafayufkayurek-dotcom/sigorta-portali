const SEARCH_MAX_LENGTH = 80;

/** Arama ve liste süzgeci — kontrol karakteri yok, uzunluk sınırlı. Prisma parametreli kalır. */
export function sanitizeSearchQuery(raw: string | undefined | null, maxLength = SEARCH_MAX_LENGTH): string {
  if (raw == null) return '';
  return String(raw)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}
