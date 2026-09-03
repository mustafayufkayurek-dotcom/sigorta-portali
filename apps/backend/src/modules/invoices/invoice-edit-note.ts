/** Fatura düzenlemesinde neden satırı notun sonuna eklenir. */
export function appendInvoiceEditNote(
  notes: string | null | undefined,
  reason: string,
  at = new Date(),
): string {
  const stamp = at.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const line = `Düzenleme (${stamp}): ${reason.trim()}`;
  const base = (notes ?? '').trim();
  return base ? `${base}\n${line}` : line;
}

export function staffDisplayName(user: { firstName?: string | null; lastName?: string | null }): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
}
