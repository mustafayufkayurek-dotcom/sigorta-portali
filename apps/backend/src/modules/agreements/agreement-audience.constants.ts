/** Sözleşme onayı zorunlu iç personel rolleri (Safran bordrolu Meridyen operasyonu).
 *  Tedarikçi, eksper, sigorta şirketi kullanıcıları kapsam dışıdır. */
export const AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES = [
  'admin',
  'manager',
  'office_staff',
  'field_staff',
  'finance',
] as const;

export type AgreementInternalPersonnelRoleCode =
  (typeof AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES)[number];

export function isInternalPersonnelRole(roleCode?: string | null): boolean {
  if (!roleCode) return false;
  const normalized = roleCode.trim().toLowerCase();
  return (AGREEMENT_INTERNAL_PERSONNEL_ROLE_CODES as readonly string[]).includes(normalized);
}
