/**
 * Tarihsel Dosya kuralı (EPIC-05 Madde 7)
 *
 * Cutoff: 2026-07-01T00:00:00+03:00 (Europe/Istanbul gece yarısı).
 * createdAt (yoksa fileDate) bu tarihten önceyse → Tarihsel Dosya.
 * Tarihsel dosyada yeni finans akışı / hakediş / cari zorunlu değildir;
 * sahte bloker ve eksik maliyet/onay uyarısı gösterilmez.
 */

export const HISTORICAL_FILE_CUTOFF_ISO = '2026-07-01T00:00:00+03:00';
export const HISTORICAL_FILE_CUTOFF_MS = Date.parse(HISTORICAL_FILE_CUTOFF_ISO);

const OPT_IN_PREFIX = 'emergency-historical-finance-optin:';

export function isHistoricalEmergencyFile(
  createdAt?: string | Date | null,
  fileDate?: string | Date | null,
): boolean {
  const raw = createdAt ?? fileDate;
  if (raw == null) return false;
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
  if (Number.isNaN(ms)) return false;
  return ms < HISTORICAL_FILE_CUTOFF_MS;
}

export function historicalFinanceOptInKey(caseId: string): string {
  return `${OPT_IN_PREFIX}${caseId}`;
}

export function readHistoricalFinanceOptIn(caseId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(historicalFinanceOptInKey(caseId)) === '1';
  } catch {
    return false;
  }
}

export function writeHistoricalFinanceOptIn(caseId: string, optedIn: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const key = historicalFinanceOptInKey(caseId);
    if (optedIn) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}
