/** Sabit / yönetim gideri kategorileri — dosyalara dağıtılır (KDV hariç tutar) */
export const OVERHEAD_CATEGORY_CODES = [
  'OFFICE_RENT',
  'PAYROLL',
  'VEHICLE_RENT',
  'SOFTWARE',
  'INSURANCE_PREMIUM',
  'ACCOUNTING_LEGAL',
] as const;

export type OverheadCategoryCode = (typeof OVERHEAD_CATEGORY_CODES)[number];

export function isOverheadCategoryCode(code: string | null | undefined): boolean {
  return OVERHEAD_CATEGORY_CODES.includes(code as OverheadCategoryCode);
}

/** Masraf kaydından KDV hariç (net) tutar */
export function toNetAmount(amount: number, vatRate: number, vatIncluded: boolean): number {
  if (!vatIncluded) return amount;
  const rate = vatRate > 0 ? vatRate : 0;
  return amount / (1 + rate / 100);
}

export function toGrossAmount(netAmount: number, vatRate: number): number {
  const rate = vatRate > 0 ? vatRate : 0;
  return netAmount * (1 + rate / 100);
}
