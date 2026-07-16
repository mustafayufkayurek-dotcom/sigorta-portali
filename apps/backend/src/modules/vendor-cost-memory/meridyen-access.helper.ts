const EXTERNAL_ROLE_CODES = new Set([
  'ADJUSTER',
  'EXPERT',
  'INSURANCE_COMPANY_USER',
  'INSURANCE_COMPANY',
  'BROKER',
  'CUSTOMER',
]);

export function isMeridyenInternalRole(roleCode?: string | null): boolean {
  if (!roleCode) return false;
  const normalized = String(roleCode).trim().toUpperCase().replace(/\s+/g, '_');
  return !EXTERNAL_ROLE_CODES.has(normalized);
}
