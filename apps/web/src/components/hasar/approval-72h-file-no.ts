/** Bildirim gövdesinden dosya no: «2026 YE 1988/1 — …» */
export function fileNoFromApproval72hBody(body?: string | null): string | null {
  const text = String(body ?? '').trim();
  if (!text) return null;
  const before = text.split('—')[0]?.trim() || text.split('-')[0]?.trim() || '';
  return before || null;
}
