function normalizeRoleCode(roleCode?: string | null): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

const MERIDYEN_STAFF_ROLES = new Set([
  'admin',
  'manager',
  'office_staff',
  'field_staff',
  'finance',
  'finans',
]);

/** İç kullanıcı (müşteri / tedarikçi / portal değil). */
export function isMeridyenStaffRole(roleCode?: string | null): boolean {
  return MERIDYEN_STAFF_ROLES.has(normalizeRoleCode(roleCode));
}

/** Rol varsayılanı — kişi kaydı yokken. */
export function workHoursGateAppliesByRole(roleCode?: string | null): boolean {
  const role = normalizeRoleCode(roleCode);
  if (!role) return false;
  if (role === 'admin' || role === 'manager') return false;
  if (
    role === 'expert'
    || role === 'adjuster'
    || role === 'insurance_company_user'
    || role === 'assistance_company_user'
  ) {
    return false;
  }
  if (role.includes('portal')) return false;
  return true;
}

export function workHoursGateApplies(input: {
  roleCode?: string | null;
  portalCustomerId?: string | null;
  restrictedOverride?: boolean | null;
}): boolean {
  if (isMeridyenStaffRole(input.roleCode) && !input.portalCustomerId) {
    if (input.restrictedOverride === true) return true;
    if (input.restrictedOverride === false) return false;
  }
  return workHoursGateAppliesByRole(input.roleCode);
}
