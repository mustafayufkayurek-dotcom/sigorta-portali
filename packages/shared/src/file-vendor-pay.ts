/** Tedarikçi giden ödemesi — Ödendi / Ödenmedi / Kayıt yok. Vade yok. */

export function vendorPaidFromOutgoingStatuses(statuses: Array<string | null | undefined>): boolean | null {
  const active = statuses.filter((s) => s === 'pending' || s === 'completed');
  if (active.length === 0) return null;
  if (active.every((s) => s === 'completed')) return true;
  return false;
}
