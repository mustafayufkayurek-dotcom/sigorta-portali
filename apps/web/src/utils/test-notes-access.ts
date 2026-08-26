/** Test Notları ekranı kalıcı olarak kapatıldı. Menü ve yetki yolu yok. */
export function canAccessTestNotes(
  _roleCode?: string | null,
  _screenPermissions?: Array<{ code?: string; canView?: boolean }> | null,
): boolean {
  return false;
}

export function canAccessTestNotesFromStorage(): boolean {
  return false;
}
