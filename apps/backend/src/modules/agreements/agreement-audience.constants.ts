/** Sözleşme onayı zorunlu iç personel rolleri (Safran bordrolu Meridyen operasyonu). */
export const AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES = [
  'admin',
  'manager',
  'office_staff',
  'field_staff',
  'finance',
] as const;

/** Harici portal kullanıcıları — KVKK + gizlilik onayı zorunlu. */
export const AGREEMENT_PORTAL_ROLE_CODES = [
  'expert',
  'insurance_company_user',
] as const;

/** Portal kullanıcıları yalnızca bu sözleşme tiplerini onaylar (iş sözleşmesi dahil değil). */
export const AGREEMENT_PORTAL_TYPES = ['kvkk', 'gizlilik'] as const;

export type AgreementInternalPersonnelRoleCode =
  (typeof AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES)[number];

export type AgreementPortalRoleCode = (typeof AGREEMENT_PORTAL_ROLE_CODES)[number];

function normalizeRoleCode(roleCode?: string | null): string {
  return (roleCode ?? '').trim().toLowerCase();
}

export function isInternalPersonnelRole(roleCode?: string | null): boolean {
  const normalized = normalizeRoleCode(roleCode);
  return (AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES as readonly string[]).includes(normalized);
}

export function isPortalAgreementRole(roleCode?: string | null): boolean {
  const normalized = normalizeRoleCode(roleCode);
  return (AGREEMENT_PORTAL_ROLE_CODES as readonly string[]).includes(normalized);
}

export function userRequiresAgreementConsent(roleCode?: string | null): boolean {
  return isInternalPersonnelRole(roleCode) || isPortalAgreementRole(roleCode);
}

export function agreementTypesForRole(roleCode?: string | null): readonly string[] | null {
  if (isInternalPersonnelRole(roleCode)) return null;
  if (isPortalAgreementRole(roleCode)) return AGREEMENT_PORTAL_TYPES;
  return [];
}
