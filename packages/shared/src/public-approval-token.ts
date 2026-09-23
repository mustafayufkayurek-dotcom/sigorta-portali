/** Dış onay linki: işlem bitince kapanır; azami 7 gün. Oluşturma / WhatsApp yolu ayrı durur. */

export const PUBLIC_APPROVAL_TOKEN_MAX_MS = 7 * 24 * 60 * 60 * 1000;

/** Eski kayıtlarda süre 30 gün yazılıdır; çıkarım yalnız yedek. */
export const PUBLIC_APPROVAL_TOKEN_LEGACY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE =
  'Bu belge zaten işleme alınmıştır ve erişime kapatılmıştır';

/** Dış onay GET/POST yanıtı tarayıcıda saklanmaz. */
export const PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL = 'no-store, no-cache, must-revalidate';

export const PUBLIC_APPROVAL_TOKEN_EVRAK_EXPIRED_MESSAGE =
  'Bu evrak linkinin süresi dolmuştur';

export const PUBLIC_APPROVAL_TOKEN_SOZLESME_EXPIRED_MESSAGE =
  'Bu sözleşme linki süresi dolmuştur';

const CONSUMED_STATUSES = new Set([
  'digitally_approved',
  'vendor_signed',
  'cancelled',
  'rejected',
  'digitally_rejected',
]);

export type PublicApprovalTokenKind = 'evrak' | 'sozlesme';

export type PublicApprovalTokenDecision =
  | { ok: true }
  | { ok: false; reason: 'closed' | 'expired' };

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPublicApprovalTokenConsumed(input: {
  status?: string | null;
  digitallyApprovedAt?: Date | string | null;
  signedAt?: Date | string | null;
}): boolean {
  if (asDate(input.digitallyApprovedAt) || asDate(input.signedAt)) return true;
  return CONSUMED_STATUSES.has(String(input.status ?? '').trim().toLowerCase());
}

export function publicApprovalTokenIssueAt(input: {
  createdAt?: Date | string | null;
  publicTokenExpiresAt?: Date | string | null;
}): Date | null {
  const created = asDate(input.createdAt);
  if (created) return created;
  const expires = asDate(input.publicTokenExpiresAt);
  if (!expires) return null;
  return new Date(expires.getTime() - PUBLIC_APPROVAL_TOKEN_LEGACY_TTL_MS);
}

export function evaluatePublicApprovalToken(input: {
  createdAt?: Date | string | null;
  publicTokenExpiresAt?: Date | string | null;
  status?: string | null;
  digitallyApprovedAt?: Date | string | null;
  signedAt?: Date | string | null;
  now?: Date;
}): PublicApprovalTokenDecision {
  if (isPublicApprovalTokenConsumed(input)) {
    return { ok: false, reason: 'closed' };
  }
  const now = input.now ?? new Date();
  const issued = publicApprovalTokenIssueAt(input);
  if (issued && now.getTime() - issued.getTime() > PUBLIC_APPROVAL_TOKEN_MAX_MS) {
    return { ok: false, reason: 'expired' };
  }
  const storedExpiry = asDate(input.publicTokenExpiresAt);
  if (storedExpiry && storedExpiry < now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true };
}

export function publicApprovalTokenErrorMessage(
  reason: 'closed' | 'expired',
  kind: PublicApprovalTokenKind,
): string {
  if (reason === 'closed') return PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE;
  return kind === 'sozlesme'
    ? PUBLIC_APPROVAL_TOKEN_SOZLESME_EXPIRED_MESSAGE
    : PUBLIC_APPROVAL_TOKEN_EVRAK_EXPIRED_MESSAGE;
}
