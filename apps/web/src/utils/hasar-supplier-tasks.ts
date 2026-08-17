/** Planlayıcı — kayıtlı görev tanımını state’e çevir (hydrate kilidi). */
export function buildSupplierTaskMapFromNotes(
  suppliers: Array<{ id: string; note?: string | null }>,
): Record<string, string> {
  const taskMap: Record<string, string> = {};
  for (const s of suppliers) {
    const note = (s.note ?? '').trim();
    if (note) taskMap[s.id] = note;
  }
  return taskMap;
}
