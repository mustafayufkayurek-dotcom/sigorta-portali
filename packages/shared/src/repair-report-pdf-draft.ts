/**
 * PDF «Taslak» damgası yalnız henüz onaya/sürece girmemiş raporlarda.
 * Onaya gönderilmiş raporda status gecikse bile damga basılmaz.
 */
const LEFT_DRAFT_ACTIONS = new Set([
  'submitted',
  'pending_approval',
  'approved',
  'sent_for_external_approval',
  'externally_approved',
  'externally_rejected',
]);

export function isRepairReportPdfDraft(
  status?: string | null,
  approvalActions?: Array<{ action?: string | null } | string> | null,
): boolean {
  const normalized = String(status ?? '').trim();
  if (normalized && normalized !== 'draft') return false;

  const actions = (approvalActions ?? []).map((entry) =>
    typeof entry === 'string' ? entry : String(entry?.action ?? ''),
  );
  if (actions.some((action) => LEFT_DRAFT_ACTIONS.has(action))) return false;

  return !normalized || normalized === 'draft';
}
