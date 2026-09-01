/** Tedarikçi kartı maliyet özeti — kayıt yoksa boş kalır; örnek satır basılmaz. */
export function tedarikciMaliyetOzetiSatirlari<T extends { serviceType?: string; count?: number }>(
  rows?: T[] | null,
): { rows: T[]; ornek: boolean } {
  if (rows && rows.length > 0) return { rows, ornek: false };
  return { rows: [], ornek: false };
}
