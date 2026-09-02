/** Hasar ofis kapanış / iptal — süreç bitmeden kapanmaz. */

export const HASAR_OFFICE_CLOSE_READY_CODES = [
  'repair_completed',
  'invoice_pending',
  'invoice_submitted',
  'payment_pending',
  'partially_collected',
] as const;

export const HASAR_CANCEL_REASON_MIN_LEN = 10;

export function hasarOfficeCloseMissing(input: {
  statusCode?: string | null;
  hasApprovedReport?: boolean;
}): string[] {
  const code = String(input.statusCode ?? '').trim().toLowerCase();
  if (code === 'closed') return [];
  if (code === 'cancelled') return ['İptal edilmiş dosya kapatılmaz'];
  const missing: string[] = [];
  if (!input.hasApprovedReport) missing.push('Onaylı rapor');
  if (!(HASAR_OFFICE_CLOSE_READY_CODES as readonly string[]).includes(code)) {
    missing.push('Onarım bitişi');
  }
  return missing;
}

export function hasarCancelReasonOk(reason?: string | null): boolean {
  return String(reason ?? '').trim().length >= HASAR_CANCEL_REASON_MIN_LEN;
}

export type HasarStatusHistoryLike = {
  toStatus?: { code?: string | null } | null;
  toStatusCode?: string | null;
  changedAt?: string | Date | null;
  note?: string | null;
  changedByUser?: { firstName?: string | null; lastName?: string | null } | null;
};

export function pickHasarCancelHistory(
  history: HasarStatusHistoryLike[] = [],
): HasarStatusHistoryLike | null {
  return (
    history.find(
      (row) => String(row.toStatus?.code ?? row.toStatusCode ?? '').toLowerCase() === 'cancelled',
    ) ?? null
  );
}

export function hasarCancelActorName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—';
}
