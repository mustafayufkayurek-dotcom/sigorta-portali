/**
 * Hasar Dosyaları liste kolonları — DATA FIELD ISOLATION.
 * Kolonlar index / sıra ile değil, yalnızca kendi alanından beslenir.
 */

export type ClaimListColumnId =
  | 'fileNo'
  | 'customer'
  | 'insured'
  | 'date'
  | 'subject'
  | 'status'
  | 'supplier'
  | 'invoice'
  | 'amount'
  | 'reportSales'
  | 'reportCost'
  | 'reportProfit'
  | 'priority'
  | 'revision'
  | 'actions';

/** Dosya No — yalnız fileNo / claimNo; sigorta adı ASLA fallback değil. */
export function claimListFileNo(claim: {
  fileNo?: string | null;
  claimNo?: string | null;
  insuranceCompany?: { name?: string | null } | null;
}): string {
  const fileNo = typeof claim.fileNo === 'string' ? claim.fileNo.trim() : '';
  if (fileNo) return fileNo;
  const claimNo = typeof claim.claimNo === 'string' ? claim.claimNo.trim() : '';
  if (claimNo) return claimNo;
  return '—';
}

/** Müşteri / Sigorta Şirketi kolonu — yalnız insuranceCompany.name */
export function claimListInsuranceCompanyName(claim: {
  insuranceCompany?: { name?: string | null } | null;
}): string {
  const name = claim.insuranceCompany?.name?.trim();
  return name || '—';
}

/**
 * Regresyon: Dosya No hücresi sigorta adı ile karışmamalı.
 * Test ve UI aynı SSOT accessor’ı kullanır.
 */
export function assertClaimListIdentityFieldsIsolated(claim: {
  fileNo?: string | null;
  claimNo?: string | null;
  insuranceCompany?: { name?: string | null } | null;
  insuredName?: string | null;
}): {
  fileNo: string;
  insuranceCompany: string;
  insuredName: string;
} {
  return {
    fileNo: claimListFileNo(claim),
    insuranceCompany: claimListInsuranceCompanyName(claim),
    insuredName: (claim.insuredName ?? '').trim() || '—',
  };
}
