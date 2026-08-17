/** Eski ensureKonuTabDepartments hatasıyla oluşmuş yanlış departman kaydı. */
export function isLegacyStajDepartment(dept: { code?: string | null; name?: string | null }): boolean {
  const code = (dept.code ?? '').trim().toLowerCase();
  const name = (dept.name ?? '').trim().toLocaleLowerCase('tr-TR');
  return code === 'staj' || name === 'staj' || code.startsWith('staj-legacy-');
}

export function filterLegacyStajDepartments<T extends { code?: string | null; name?: string | null }>(
  departments: T[],
): T[] {
  return departments.filter((dept) => !isLegacyStajDepartment(dept));
}
