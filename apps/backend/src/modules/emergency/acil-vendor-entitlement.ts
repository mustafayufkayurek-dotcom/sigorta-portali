/**
 * Acil Yardım tedarikçi hakedişi — Hasar vadesi (15/30) buraya uygulanmaz.
 */

export function pickAcilHakedisAmount(
  entries: Array<{ entryType: string; amount: number; vendorId?: string | null }>,
  vendorId: string,
): number {
  const vendorGider = entries
    .filter((e) => e.entryType === 'gider' && e.vendorId === vendorId)
    .reduce((s, e) => s + e.amount, 0);
  if (vendorGider > 0) return vendorGider;
  return entries.filter((e) => e.entryType === 'gider').reduce((s, e) => s + e.amount, 0);
}

/** Acil tedarikçisine ödeme vadesi yok. */
export function acilHakedisDueDate(_vendorPaymentDueDays?: number | null): null {
  return null;
}

export function acilHakedisFinanceNote(grantedAt: Date): string {
  const at = grantedAt.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Hakediş verildi · ${at} · Vade yok`;
}

/** Finans ödeme kuyruğundaki Acil satır kimliği. Hasar Payment id ile karışmaz. */
export const ACIL_FINANCE_QUEUE_ID_PREFIX = 'acil-ent-';

export function acilEntitlementQueueId(entitlementId: string): string {
  return `${ACIL_FINANCE_QUEUE_ID_PREFIX}${entitlementId}`;
}

export function parseAcilEntitlementQueueId(id: string): string | null {
  if (!id.startsWith(ACIL_FINANCE_QUEUE_ID_PREFIX)) return null;
  const rest = id.slice(ACIL_FINANCE_QUEUE_ID_PREFIX.length).trim();
  return rest || null;
}

export function toAcilFinanceQueueRow(row: {
  id: string;
  caseId: string;
  caseNo: string;
  vendorName: string;
  amount: number;
  grantedAt: Date;
  vendorPaid: boolean | null;
}) {
  const paid = row.vendorPaid === true;
  return {
    id: acilEntitlementQueueId(row.id),
    queueSource: 'acil_hakedis' as const,
    emergencyCaseId: row.caseId,
    claimFileId: null as string | null,
    claimFile: { fileNo: row.caseNo, id: row.caseId },
    paymentType: 'outgoing' as const,
    paymentDate: row.grantedAt.toISOString(),
    dueDate: acilHakedisDueDate(),
    amount: row.amount,
    currency: 'TRY',
    method: 'eft',
    payerType: 'vendor' as const,
    vendorName: row.vendorName,
    status: (paid ? 'completed' : 'pending') as 'completed' | 'pending',
    note: acilHakedisFinanceNote(row.grantedAt),
    collectionChannel: null as string | null,
  };
}
