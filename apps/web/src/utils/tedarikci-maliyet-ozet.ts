/** Tedarikçi kartı maliyet özeti — gerçek kayıt yoksa örnek satır (finansa gitmez). */
export const ORNEK_TEDARIKCI_MALIYET_OZETI = [
  { serviceType: 'Sıva-Boya', minCost: 1500, avgCost: 2667, maxCost: 4000, lastCost: 2500, count: 3 },
  { serviceType: 'Mobilya İşleri', minCost: 10_000, avgCost: 10_000, maxCost: 10_000, lastCost: 10_000, count: 1 },
] as const;

export function tedarikciMaliyetOzetiSatirlari<T extends { serviceType?: string; count?: number }>(
  rows?: T[] | null,
): { rows: Array<T | (typeof ORNEK_TEDARIKCI_MALIYET_OZETI)[number]>; ornek: boolean } {
  if (rows && rows.length > 0) return { rows, ornek: false };
  return { rows: [...ORNEK_TEDARIKCI_MALIYET_OZETI], ornek: true };
}
