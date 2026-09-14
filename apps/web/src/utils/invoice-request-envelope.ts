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

export const SATIS_FATURA_TALEPLERI_YOL = '/panel/finans/fatura-talepleri';

/** Faturalar sayfası kesilen belgedir. Eski ?tab=talepler ayrı talepler sayfasına gider. */
export function resolveFaturaListTab(
  tabParam: string | null | undefined,
  _isFinance?: boolean,
): FaturaListTab {
  if (tabParam === 'talepler') return 'talepler';
  return 'kesilen';
}

export function faturaListTabHref(tab: FaturaListTab): string {
  if (tab === 'talepler') return SATIS_FATURA_TALEPLERI_YOL;
  return '/panel/finans/faturalar';
}

const TALEP_STATUS = ['pending', 'approved', 'invoiced', 'cancelled'] as const;
export type FaturaTalepFilter = 'tumu' | (typeof TALEP_STATUS)[number];

/** Satış Fatura Talepleri iş kuyruğu: tab yoksa Bekliyor. Faturalandı varsayılan listede durmaz. */
export function resolveFaturaTalepFilter(
  statusParam: string | null | undefined,
): FaturaTalepFilter {
  const status = String(statusParam ?? '').trim();
  if (status === 'tumu') return 'tumu';
  if ((TALEP_STATUS as readonly string[]).includes(status)) {
    return status as (typeof TALEP_STATUS)[number];
  }
  return 'pending';
}

export function faturaTalepleriHref(filter: FaturaTalepFilter = 'pending'): string {
  if (filter === 'pending') return SATIS_FATURA_TALEPLERI_YOL;
  return `${SATIS_FATURA_TALEPLERI_YOL}?status=${filter}`;
}
