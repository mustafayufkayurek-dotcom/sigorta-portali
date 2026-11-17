export type ApprovalDelivery = 'to' | 'cc' | 'bcc';

export type ApprovalRecipientRow = {
  email: string;
  delivery: ApprovalDelivery;
  [key: string]: unknown;
};

const keyOf = (email: string) => email.trim().toLowerCase();

/**
 * Tek Kime kuralı: yeni Kime seçilince önceki Kime otomatik Bilgi olur.
 * Hitap (Sn. Soyad) yalnız bir muhataba yazılır.
 */
export function enforceSingleApprovalTo<T extends ApprovalRecipientRow>(
  recipients: T[],
  nextToEmail?: string | null,
): T[] {
  const preferred = String(nextToEmail ?? '').trim();
  const preferredKey = preferred ? keyOf(preferred) : '';
  let toKey = preferredKey;
  if (!toKey) {
    const existingTo = recipients.find((row) => row.delivery === 'to');
    toKey = existingTo ? keyOf(existingTo.email) : '';
  }
  if (!toKey && recipients.length) toKey = keyOf(recipients[0]!.email);
  return recipients.map((row) => {
    const key = keyOf(row.email);
    if (toKey && key === toKey) return { ...row, delivery: 'to' as const };
    if (row.delivery === 'to') return { ...row, delivery: 'cc' as const };
    return row;
  });
}
