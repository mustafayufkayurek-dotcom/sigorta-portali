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

/** Tek fişte birden fazla KDV satırının matrah / KDV / genel toplamı. */
export function sumSplitGrossVatLines(
  lines: ReadonlyArray<{ amount: number; vatRate: number }>,
): {
  matrah: number;
  vatAmount: number;
  genelToplam: number;
  lineCount: number;
} {
  let matrah = 0;
  let vatAmount = 0;
  let genelToplam = 0;
  let lineCount = 0;
  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const split = splitGrossVat(amount, Number(line.vatRate) || 0);
    matrah = round2(matrah + split.matrah);
    vatAmount = round2(vatAmount + split.vatAmount);
    genelToplam = round2(genelToplam + split.genelToplam);
    lineCount += 1;
  }
  return { matrah, vatAmount, genelToplam, lineCount };
}

export function expenseDocumentModeFromFlag(hasTaxDocument: unknown): ExpenseDocumentMode {
  return hasTaxDocument === false ? 'belgesiz' : 'belgeli';
}

export function hasTaxDocumentFromMode(mode: unknown): boolean {
  return String(mode ?? '').trim() !== 'belgesiz';
}

const MASRAF_DOC_TYPE_RE = /^(Kasa Fişi|Fatura)$/i;
const MASRAF_DOC_NO_RE = /^(?:Belge\s*No\s*[:：]\s*)(.+)$/i;

/**
 * Eski kayıtlarda açıklamaya gömülü «Kasa Fişi · Belge No: 91 · …» ayrıştırır.
 * Yeni kayıtta tür/no ayrı sütundadır; açıklama yalnız açıklamadır.
 */
export function parseMasrafDocumentFields(input: {
  description?: string | null;
  receiptDocumentType?: string | null;
  receiptDocumentNo?: string | null;
}): {
  documentType: string;
  documentNo: string;
  description: string;
} {
  const storedType = String(input.receiptDocumentType ?? '').trim();
  const storedNo = String(input.receiptDocumentNo ?? '').trim();
  if (storedType || storedNo) {
    return {
      documentType: storedType,
      documentNo: storedNo,
      description: String(input.description ?? '').trim(),
    };
  }

  const raw = String(input.description ?? '').trim();
  if (!raw) return { documentType: '', documentNo: '', description: '' };

  const parts = raw.split(/\s*[·\-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  let documentType = '';
  let documentNo = '';
  const rest: string[] = [];
  for (const part of parts) {
    if (!documentType && MASRAF_DOC_TYPE_RE.test(part)) {
      documentType = /fatura/i.test(part) ? 'Fatura' : 'Kasa Fişi';
      continue;
    }
    const noMatch = part.match(MASRAF_DOC_NO_RE);
    if (!documentNo && noMatch) {
      documentNo = String(noMatch[1] ?? '').trim();
      continue;
    }
    rest.push(part);
  }
  return {
    documentType,
    documentNo,
    description: rest.join(' · ').trim() || (documentType || documentNo ? '' : raw),
  };
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
