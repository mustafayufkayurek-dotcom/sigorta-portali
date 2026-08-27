/** Alternatif aramadan dosyaya özel kayıt — havuz önerisine girmez. */
export const ACIL_FILE_ONLY_VENDOR_NOTE = 'Yalnızca bu dosyada kullanım.';
export const ACIL_POOL_VENDOR_NOTE = 'Meridyen Tedarikçi Havuzuna eklendi.';

export function isAcilFileOnlyVendor(vendor?: { notes?: string | null } | null): boolean {
  return Boolean(vendor?.notes?.includes(ACIL_FILE_ONLY_VENDOR_NOTE));
}
