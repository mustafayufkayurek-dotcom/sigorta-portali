/**
 * Acil tespit bulgusu — boş PATCH mevcut metni silmez.
 * Personel kapanışta yazar; dosya kapanınca veya başka alan güncellenince silinmez.
 */
export function nextEmergencyFindingsText(
  incoming: string | null | undefined,
  current?: string | null,
): string | undefined {
  if (incoming === undefined) return undefined;
  const next = String(incoming ?? '').trim();
  if (next) return next;
  const kept = String(current ?? '').trim();
  return kept || undefined;
}
