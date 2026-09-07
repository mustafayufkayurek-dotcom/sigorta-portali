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

/**
 * Ekrandaki / yereldeki yazı, boş sunucu yanıtıyla silinmez.
 * Adım değişince veya dosya yenilenirken yazılan durur.
 */
export function resolveEmergencyFindingsDraft(parts: {
  server?: string | null;
  inMemory?: string | null;
  stored?: string | null;
}): string {
  const memory = String(parts.inMemory ?? '');
  if (memory.trim()) return memory;
  const stored = String(parts.stored ?? '');
  if (stored.trim()) return stored;
  return String(parts.server ?? '');
}
