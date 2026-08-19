/**
 * Dashboard API zarfı — { success, data } veya ham gövde.
 * Widget'lar dizi/özet bekler; zarf yüzünden boş kalmasın.
 */
export function unwrapDashboardData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const envelope = raw as { success?: unknown; data?: T };
    if (envelope.success === false) return raw as T;
    if (envelope.data !== undefined) return envelope.data;
  }
  return raw as T;
}

export function asDashboardItemList<T>(raw: unknown): T[] {
  const body = unwrapDashboardData<unknown>(raw);
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.items)) return rec.items as T[];
    if (Array.isArray(rec.data)) return rec.data as T[];
  }
  return [];
}
