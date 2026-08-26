/** Personel sayfası kadrosu: yalnız «Personel Ekle» kaydı. Test/demo/yönetici yok. */

export const HR_ROSTER_ROLE_CODES = [
  'office_staff',
  'OFFICE_STAFF',
  'field_staff',
  'FIELD_STAFF',
  'finance',
  'FINANCE',
  'FINANS',
  'accountant',
  'ACCOUNTANT',
  'manager',
  'MANAGER',
] as const;

export function isHrRosterRole(roleCode?: string | null): boolean {
  const code = (roleCode ?? '').trim().toLowerCase();
  return (
    code === 'office_staff'
    || code === 'field_staff'
    || code === 'finance'
    || code === 'finans'
    || code === 'accountant'
    || code === 'manager'
  );
}

export function isExcludedFromHrRoster(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  roleCode?: string | null;
}): boolean {
  const role = (input.roleCode ?? '').trim().toLowerCase();
  if (role === 'admin') return true;

  const email = (input.email ?? '').trim().toLowerCase();
  if (
    email.includes('meridyen-test.local')
    || email.endsWith('@example.com')
    || email.includes('@deleted.meridyen.local')
  ) {
    return true;
  }

  const first = (input.firstName ?? '').trim().toLocaleLowerCase('tr-TR');
  const last = (input.lastName ?? '').trim().toLocaleLowerCase('tr-TR');
  const full = `${first} ${last}`.trim();

  if (first.startsWith('test')) return true;
  if (full.includes('demo')) return true;
  if (full.includes('geçici') || full.includes('gecici')) return true;
  if (last.includes('dosya sorumlusu') && first.includes('test')) return true;

  return false;
}

export function belongsOnHrPersonnelRoster(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  roleCode?: string | null;
}): boolean {
  return isHrRosterRole(input.roleCode) && !isExcludedFromHrRoster(input);
}
