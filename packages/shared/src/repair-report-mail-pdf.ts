/** Graph sendMail gövde eki üst sınırı ile aynı. */
export const REPAIR_REPORT_MAIL_INLINE_MAX_BYTES = 3_000_000;

function foldRecipientEmail(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

function isSharedOperationalMailbox(email?: string | null): boolean {
  const folded = foldRecipientEmail(email);
  if (folded === 'ihbar@safranbh.com' || folded === 'hasar@safranbh.com') return true;
  const [local, host] = folded.split('@');
  if (local !== 'ihbar' && local !== 'hasar') return false;
  return host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com');
}

export function internalRepairPdfFilename(reportNo: string): string {
  return `hasar-raporu-IC-${String(reportNo ?? '').trim()}.pdf`;
}

export function isInternalRepairPdfFilename(filename?: string | null): boolean {
  return /^hasar-raporu-ic-/i.test(String(filename ?? '').trim());
}

/**
 * İç PDF yalnız Meridyen yönetici kutusuna gider.
 * Müşteri, eksper, acente ve ortak ihbar/hasar kutusu alamaz.
 */
export function canAttachInternalRepairPdf(recipientEmail?: string | null): boolean {
  const folded = foldRecipientEmail(recipientEmail);
  if (!folded.includes('@')) return false;
  if (isSharedOperationalMailbox(folded)) return false;
  const host = folded.split('@')[1] || '';
  return host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com');
}

export function filterRepairReportMailAttachments<T extends { filename?: string | null }>(
  recipientEmail: string,
  attachments: T[],
): T[] {
  return attachments.filter((item) => {
    if (!isInternalRepairPdfFilename(item.filename)) return true;
    return canAttachInternalRepairPdf(recipientEmail);
  });
}

export function packInlineMailAttachments<T extends { content?: { length?: number } | null }>(
  attachments: T[],
  maxBytes = REPAIR_REPORT_MAIL_INLINE_MAX_BYTES,
): T[] {
  const packed: T[] = [];
  let used = 0;
  for (const item of attachments) {
    const size = item.content?.length ?? 0;
    if (size <= 0) continue;
    if (used + size > maxBytes) continue;
    packed.push(item);
    used += size;
  }
  return packed;
}
