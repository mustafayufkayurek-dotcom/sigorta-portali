/** Nest { success, data } veya ham gövde — finans listesi zarf yüzünden boş kalmasın. */
export function unwrapApiData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const envelope = raw as { success?: unknown; data?: T };
    if (envelope.success === false) return raw as T;
    if (envelope.data !== undefined) return envelope.data;
  }
  return raw as T;
}

export function asInvoiceRequestList(raw: unknown): unknown[] {
  const body = unwrapApiData<unknown>(raw);
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.items)) return rec.items;
    if (Array.isArray(rec.data)) return rec.data;
  }
  return [];
}

export type FaturaListTab = 'kesilen' | 'talepler';

/** Finans menüsü Fatura Talepleri; tab yoksa finans kullanıcısı talepler listesini görür. */
export function resolveFaturaListTab(
  tabParam: string | null | undefined,
  isFinance: boolean,
): FaturaListTab {
  if (tabParam === 'talepler') return 'talepler';
  if (tabParam === 'kesilen') return 'kesilen';
  return isFinance ? 'talepler' : 'kesilen';
}

export function faturaListTabHref(tab: FaturaListTab): string {
  return `/panel/finans/faturalar?tab=${tab}`;
}
