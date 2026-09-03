export const INVOICE_REQUEST_SEEN_KEY = 'invoice-request-alert:seen-ids';
export const INVOICE_REQUEST_SESSION_KEY = 'invoice-request-alert:session-dismissed';
export const INVOICE_REQUEST_TITLE_FLASH = '● Yeni fatura talebi';

export function readSeenInvoiceRequestIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INVOICE_REQUEST_SEEN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeSeenInvoiceRequestIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INVOICE_REQUEST_SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function unseenInvoiceRequestIds(pendingIds: string[], seenIds: string[] = readSeenInvoiceRequestIds()): string[] {
  const seen = new Set(seenIds);
  return pendingIds.filter((id) => !seen.has(id));
}

export function markInvoiceRequestsSeen(pendingIds: string[]): void {
  const merged = Array.from(new Set([...readSeenInvoiceRequestIds(), ...pendingIds]));
  writeSeenInvoiceRequestIds(merged);
}

export function isInvoiceRequestSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(INVOICE_REQUEST_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInvoiceRequestSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(INVOICE_REQUEST_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function faturaTalepleriTabPulseClass(pendingCount: number, _unseenCount?: number): string {
  if (pendingCount <= 0) return '';
  return 'animate-pulse ring-2 ring-amber-400 ring-offset-1';
}
