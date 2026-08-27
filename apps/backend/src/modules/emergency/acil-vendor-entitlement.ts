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
