/**
 * Dashboard satır navigasyonu — id varsa detay, yoksa arama; hedef yoksa null.
 */
export function claimDetailHref(id?: string | null): string | null {
  const trimmed = typeof id === 'string' ? id.trim() : '';
  if (!trimmed) return null;
  return `/panel/hasar-dosyalari/${encodeURIComponent(trimmed)}?grup=operasyon`;
}

export function claimSearchHref(fileNo?: string | null): string | null {
  const trimmed = typeof fileNo === 'string' ? fileNo.trim() : '';
  if (!trimmed) return null;
  return `/panel/hasar-dosyalari?search=${encodeURIComponent(trimmed)}`;
}

/** Öncelik: claim id → detay; aksi halde fileNo → liste araması. */
export function claimNavHref(opts: {
  id?: string | null;
  fileNo?: string | null;
}): string | null {
  return claimDetailHref(opts.id) ?? claimSearchHref(opts.fileNo);
}

export const CLAIM_LIST_OPEN_HREF = '/panel/hasar-dosyalari?status=open';
export const CLAIM_LIST_SLA_HREF = '/panel/hasar-dosyalari?status=sla_exceeded';
export const CLAIM_LIST_HREF = '/panel/hasar-dosyalari';
export const OPERATIONS_CENTER_HREF = '/panel/operasyon';
export const STAFF_MGMT_HREF = '/panel/personel-yonetimi';

/** Ownership satırı — mevcut personel yönetimi rotası (yeni query uydurma yok). */
export function staffLoadHref(_userId?: string | null): string {
  return STAFF_MGMT_HREF;
}
