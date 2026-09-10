export const PORTAL_CUSTOMER_SUB_TYPES = [
  'eksper_firmasi',
  'eksper',
  'sigorta_sirketi',
  'broker_firmasi',
  'asistan_firmasi',
] as const;

export type PortalCustomerSubType = (typeof PORTAL_CUSTOMER_SUB_TYPES)[number];

export function isPortalCustomerSubType(subType?: string | null): subType is PortalCustomerSubType {
  return PORTAL_CUSTOMER_SUB_TYPES.includes((subType ?? '') as PortalCustomerSubType);
}

/** Kart alt tipi → sistem rol kodları (ilk bulunan kullanılır) */
export function roleCodesForPortalCustomerSubType(subType?: string | null): string[] {
  const value = (subType ?? '').trim();
  if (value === 'eksper_firmasi' || value === 'eksper') return ['expert', 'adjuster'];
  if (value === 'sigorta_sirketi') return ['insurance_company_user'];
  if (value === 'broker_firmasi') return ['broker_user', 'broker'];
  if (value === 'asistan_firmasi') return ['assistance_company_user'];
  return [];
}

export function normalizePortalRoleCode(code?: string | null): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}
