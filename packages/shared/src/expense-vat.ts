/** Masraf KDV — KDV dahil tutardan matrah / KDV / toplam. */

export const FINANS_MASRAF_KDV_ORANLARI_AYAR_KEY = 'finans_masraf_kdv_oranlari';

export const DEFAULT_MASRAF_KDV_ORANLARI = [1, 10, 20] as const;

export type ExpenseDocumentMode = 'belgeli' | 'belgesiz';

export type ExpenseVatFate = 'deductible' | 'lost' | 'recovery';

export function normalizeMasrafKdvOranlari(raw: unknown): number[] {
  const fallback = [...DEFAULT_MASRAF_KDV_ORANLARI];
  if (!Array.isArray(raw)) return fallback;
  const rates = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    .map((n) => Math.round(n * 100) / 100);
  const uniq = Array.from(new Set(rates)).sort((a, b) => a - b);
  return uniq.length > 0 ? uniq : fallback;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** KDV dahil tutardan matrah, KDV ve genel toplam. */
export function splitGrossVat(grossAmount: number, vatRate: number): {
  matrah: number;
  vatAmount: number;
  genelToplam: number;
  vatRate: number;
} {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const rate = Math.max(0, Number(vatRate) || 0);
  if (rate <= 0) {
    return { matrah: round2(gross), vatAmount: 0, genelToplam: round2(gross), vatRate: 0 };
  }
  const matrah = round2(gross / (1 + rate / 100));
  const vatAmount = round2(gross - matrah);
  return { matrah, vatAmount, genelToplam: round2(gross), vatRate: rate };
}

export function expenseDocumentModeFromFlag(hasTaxDocument: unknown): ExpenseDocumentMode {
  return hasTaxDocument === false ? 'belgesiz' : 'belgeli';
}

export function hasTaxDocumentFromMode(mode: unknown): boolean {
  return String(mode ?? '').trim() !== 'belgesiz';
}

/**
 * Belgesiz → kayıp KDV.
 * Harici + belgeli → telafi (kayıp KDV’yi karşılar).
 * Diğer belgeli → indirilecek KDV.
 */
export function resolveExpenseVatFate(input: {
  hasTaxDocument?: boolean | null;
  operationSubject?: string | null;
  isHariciLane?: boolean;
}): ExpenseVatFate {
  const harici =
    input.isHariciLane === true
    || String(input.operationSubject ?? '').trim() === 'HARICI_MASRAF';
  if (input.hasTaxDocument === false) return 'lost';
  if (harici) return 'recovery';
  return 'deductible';
}
