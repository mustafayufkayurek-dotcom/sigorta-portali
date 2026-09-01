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

export const ACIL_HAKEDIS_PAYMENT_REF_PREFIX = 'ACIL-HAKEDIS:';

export function acilHakedisPaymentRef(caseId: string): string {
  return `${ACIL_HAKEDIS_PAYMENT_REF_PREFIX}${caseId}`;
}

/** Ödendi damgası kuyrukta tamamlanır; aksi halde finans ödeyecek (bekler). */
export function acilHakedisOutgoingStatus(
  vendorPaid: boolean | null | undefined,
): 'pending' | 'completed' {
  return vendorPaid === true ? 'completed' : 'pending';
}

export function acilHakedisActorName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
}

export function acilHakedisPaidDescription(input: {
  paid: boolean;
  actorName?: string | null;
  source?: 'file' | 'finance_queue' | string | null;
}): string {
  const base = input.paid ? 'Tedarikçi ödemesi: ödendi' : 'Tedarikçi ödemesi: ödenmedi';
  const name = (input.actorName ?? '').trim();
  const sourceLabel = input.source === 'finance_queue' ? 'ödemeler' : input.source === 'file' ? 'dosya' : '';
  const who = [name, sourceLabel ? `(${sourceLabel})` : ''].filter(Boolean).join(' ');
  return who ? `${base} · ${who}` : base;
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
