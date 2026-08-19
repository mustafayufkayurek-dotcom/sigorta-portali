/** Dashboard JWT / Prisma rol kodu — seed (office_staff) ve legacy (OFFICE_STAFF) aynı kabul. */

export function normalizeDashboardRoleCode(userOrCode: unknown): string {
  const raw =
    typeof userOrCode === 'string' || userOrCode == null
      ? userOrCode
      : (userOrCode as { role?: { code?: string | null }; roleCode?: string | null }).role?.code
        ?? (userOrCode as { roleCode?: string | null }).roleCode;
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

export function isOfficeStaffDashboardRole(roleCode: string): boolean {
  return normalizeDashboardRoleCode(roleCode) === 'office_staff';
}

const FINANCE_ACCESS_ROLES = new Set([
  'admin',
  'manager',
  'ops_manager',
  'finance',
  'finans',
  'accountant',
]);

export function hasDashboardFinanceAccessRole(roleCode: string): boolean {
  return FINANCE_ACCESS_ROLES.has(normalizeDashboardRoleCode(roleCode));
}

/** pendingActionOwner hem küçük hem büyük harf / finans alias ile eşleşsin. */
export function pendingActionOwnerAliases(roleCode: string): string[] {
  const n = normalizeDashboardRoleCode(roleCode);
  const aliases = new Set<string>([n, n.toUpperCase()]);
  if (n === 'office_staff') {
    aliases.add('OFFICE_STAFF');
    aliases.add('office-staff');
  }
  if (n === 'field_staff') {
    aliases.add('FIELD_STAFF');
    aliases.add('field-staff');
  }
  if (n === 'finance' || n === 'finans' || n === 'accountant') {
    aliases.add('finance');
    aliases.add('FINANCE');
    aliases.add('finans');
    aliases.add('FINANS');
    aliases.add('accountant');
    aliases.add('ACCOUNTANT');
  }
  return [...aliases].filter(Boolean);
}
