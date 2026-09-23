/** Acil finans listesi / hakediş / taslak — yalnız yönetici veya Acil vekaletli finans. */

function normalizeRoleCode(roleCode: string | null | undefined): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

const FINANCE_ROLE_CODES = new Set(['finance', 'finans', 'accountant']);

export function isAcilFinanceRole(roleCode: string | null | undefined): boolean {
  return FINANCE_ROLE_CODES.has(normalizeRoleCode(roleCode));
}

export function isAcilFinanceAdmin(roleCode: string | null | undefined): boolean {
  return normalizeRoleCode(roleCode) === 'admin';
}

/** Ekran kapısı ile aynı: admin, veya finans + Acil vekalet. */
export function canOpenAcilFinanceAccess(
  roleCode: string | null | undefined,
  hasAcilYardimDelegation: boolean,
): boolean {
  if (isAcilFinanceAdmin(roleCode)) return true;
  return isAcilFinanceRole(roleCode) && hasAcilYardimDelegation === true;
}
