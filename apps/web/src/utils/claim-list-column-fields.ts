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

function foldTR(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
}

/** "EUREKO" / "Eureko Sigorta" aynı markadır; rakamsız metin dosya no değildir. */
export function isInsuranceBrandFileNo(value: string, insuranceName?: string | null): boolean {
  const text = value.trim();
  if (!text) return false;
  if (!/\d/.test(text)) return true;
  const company = foldTR(insuranceName ?? '');
  if (!company) return false;
  const file = foldTR(text);
  if (file === company) return true;
  const first = company.split(' ')[0] ?? '';
  return first.length >= 4 && file === first;
}

function asFileNoCandidate(value: unknown, insuranceName: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (isInsuranceBrandFileNo(text, insuranceName)) return '';
  return text;
}

/** Dosya No — yalnız fileNo / claimNo; sigorta adı ASLA fallback ve ASLA dosya no yerine yazılmaz. */
export function claimListFileNo(claim?: {
  fileNo?: string | null;
  claimNo?: string | null;
  insuranceCompany?: { name?: string | null } | null;
} | null): string {
  if (!claim) return '—';
  const insuranceName = claim.insuranceCompany?.name?.trim() ?? '';
  const fileNo = asFileNoCandidate(claim.fileNo, insuranceName);
  if (fileNo) return fileNo;
  const claimNo = asFileNoCandidate(claim.claimNo, insuranceName);
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
