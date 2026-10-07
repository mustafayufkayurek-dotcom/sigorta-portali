/** Hasar raporu MM kategorisi ve dijital muvafakatta mağdur kutusu. */

import {
  repairItemResolvedSupplierTotal,
  repairItemSalesTotal,
  type RepairItemTotalsInput,
} from './repair-report-item-totals';

export const MALI_MESULIYET_LOKASYON = [
  'yan_daire',
  'alt_kat',
  'ust_kat',
  'ortak_alan',
] as const;

export type MaliMesuliyetLokasyon = (typeof MALI_MESULIYET_LOKASYON)[number];

export const MALI_MESULIYET_LOKASYON_ETIKET: Record<MaliMesuliyetLokasyon, string> = {
  yan_daire: 'Yan Komşu',
  alt_kat: 'Alt Kat',
  ust_kat: 'Üst Kat',
  ortak_alan: 'Ortak Alan',
};

export function isMaliMesuliyetLokasyon(value: string | null | undefined): value is MaliMesuliyetLokasyon {
  return MALI_MESULIYET_LOKASYON.includes(String(value ?? '').trim() as MaliMesuliyetLokasyon);
}

export function maliMesuliyetDaireNoOk(
  lokasyon: string,
  daireNo: string | number | null | undefined,
): boolean {
  const no = String(daireNo ?? '').trim();
  if (lokasyon === 'ortak_alan') return true;
  return no.length > 0;
}

export function maliMesuliyetAlanToplami(items: RepairItemTotalsInput[]): {
  sales: number;
  cost: number;
} {
  return {
    sales: items.reduce((sum, item) => sum + repairItemSalesTotal(item), 0),
    cost: items.reduce((sum, item) => sum + repairItemResolvedSupplierTotal(item), 0),
  };
}

export type MaliMesuliyetGrandTotalInput = {
  mainReportItems: RepairItemTotalsInput[];
  neighborItems: RepairItemTotalsInput[];
};

/** Ana rapor kalemleri + komşu alan kalemleri. Aynı kalem iki kez toplanmaz. */
export function claimFileReportGrandTotal(input: MaliMesuliyetGrandTotalInput): {
  mainSales: number;
  neighborSales: number;
  genelToplam: number;
  mainCost: number;
  neighborCost: number;
  genelMaliyet: number;
} {
  const main = maliMesuliyetAlanToplami(input.mainReportItems);
  const neighbor = maliMesuliyetAlanToplami(input.neighborItems);
  return {
    mainSales: main.sales,
    neighborSales: neighbor.sales,
    genelToplam: main.sales + neighbor.sales,
    mainCost: main.cost,
    neighborCost: neighbor.cost,
    genelMaliyet: main.cost + neighbor.cost,
  };
}

export const MALI_MESULIYET_MUVAFAKAT_VERILDI = 'muvafakat_verildi';
export const MALI_MESULIYET_MUVAFAKAT_RED = 'digitally_rejected';
export const MALI_MESULIYET_MUVAFAKAT_BEKLIYOR = 'pending';

export function neighborKalemLinkedToReport(
  repairReportItemId: string | null | undefined,
): boolean {
  return Boolean(String(repairReportItemId ?? '').trim());
}

/** Mağdur kutusu yalnız asıl muvafakatta ve raporda MM kalemi varken durur. */
export function muvafakatShowsMagdur(mmKalemCount: number, documentKind?: string | null): boolean {
  if (String(documentKind ?? '') === 'muvafakatname_on_is') return false;
  if (documentKind && documentKind !== 'muvafakatname') return false;
  return tespiCount(mmKalemCount) > 0;
}

function tespiCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatMaliMesuliyetMahal(
  lokasyon: MaliMesuliyetLokasyon,
  daireNo?: string | null,
): string {
  const etiket = MALI_MESULIYET_LOKASYON_ETIKET[lokasyon];
  if (lokasyon === 'ortak_alan') return `${etiket} - Ortak`;
  const no = String(daireNo ?? '').trim();
  return no ? `${etiket} - Daire ${no}` : `${etiket} - Daire`;
}

export function parseMaliMesuliyetMahal(location: string | null | undefined): {
  lokasyon: MaliMesuliyetLokasyon | '';
  daireNo: string;
} {
  const raw = String(location ?? '').trim();
  for (const code of MALI_MESULIYET_LOKASYON) {
    const etiket = MALI_MESULIYET_LOKASYON_ETIKET[code];
    if (raw === etiket || raw.startsWith(`${etiket} -`) || raw.startsWith(`${etiket} ·`)) {
      const rest = raw.slice(etiket.length).replace(/^\s*[-·]\s*/, '');
      const daire = rest.replace(/^Daire\s*/i, '').replace(/^Ortak$/i, '').trim();
      return { lokasyon: code, daireNo: code === 'ortak_alan' ? '' : daire };
    }
  }
  return { lokasyon: '', daireNo: '' };
}

export function maliMesuliyetKonumYazi(
  tespipler: Array<{ lokasyon: string; daireNo?: string | null } | { location?: string | null }>,
): string {
  return tespipler
    .map((row) => {
      if ('location' in row) {
        return String(row.location ?? '').trim();
      }
      const etiket = isMaliMesuliyetLokasyon(row.lokasyon)
        ? MALI_MESULIYET_LOKASYON_ETIKET[row.lokasyon]
        : row.lokasyon;
      const no = String(row.daireNo ?? '').trim();
      if (row.lokasyon === 'ortak_alan') return formatMaliMesuliyetMahal('ortak_alan');
      return no ? formatMaliMesuliyetMahal(row.lokasyon as MaliMesuliyetLokasyon, no) : etiket;
    })
    .filter(Boolean)
    .join(', ');
}
