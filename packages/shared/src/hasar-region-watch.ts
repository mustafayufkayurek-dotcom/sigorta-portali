/** Hasar bölge izi: dosya sorumlusu ayrı, bölge personeli ayrı. İstisna yalnız dosya konusudur. */

function foldTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export type HasarRegionCoverageConfig = {
  claimSubjectIds?: unknown;
  ihbarSubjects?: unknown;
};

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/** Kapsam tüm konular. Konu listesi yazılınca yalnız o konular bölge mailidir. */
export function hasarResponsibilityCoversSubject(input: {
  coverageType?: string | null;
  coverageConfig?: HasarRegionCoverageConfig | null;
  claimSubjectId?: string | null;
  claimSubjectName?: string | null;
}): boolean {
  const type = String(input.coverageType ?? 'all').trim() || 'all';
  if (type !== 'specific_subjects') return true;
  const ids = stringList(input.coverageConfig?.claimSubjectIds);
  const names = stringList(input.coverageConfig?.ihbarSubjects).map(foldTr);
  if (ids.length === 0 && names.length === 0) return true;
  const subjectId = String(input.claimSubjectId ?? '').trim();
  if (subjectId && ids.includes(subjectId)) return true;
  const subjectName = foldTr(String(input.claimSubjectName ?? ''));
  if (subjectName && names.includes(subjectName)) return true;
  return false;
}
