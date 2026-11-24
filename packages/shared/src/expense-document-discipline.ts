/**
 * Masraf belge disiplini — aynı ödeme kaynağında 25 ≡ 025 ≡ 0025.
 * Dosya bağlı Hasar / Acil hakediş uyarısı kaydı kesmez; pencerede gösterilir.
 */

export const EXPENSE_DOCUMENT_REVIEW_CODE = 'EXPENSE_DOCUMENT_REVIEW' as const;

export const EXPENSE_DOCUMENT_DUPLICATE_MESSAGE =
  'Bu tedarikçide aynı veya benzer belge no zaten kayıtlı. Önce mevcut faturaları kontrol edin.';

export const EXPENSE_FILE_HAKEDIS_WARN_MESSAGE =
  'Bu dosyada seçilen tedarikçiye hakediş verilmiş. Çift kayıt riski için listedeki hakedişi kontrol edin.';

export const EXPENSE_DOCUMENT_OVERRIDE_REASON_MIN = 8;

export type ExpenseHakedisFileKind = 'hasar' | 'acil';

export type ExpenseDocumentDuplicateRow = {
  id: string;
  receiptDocumentNo: string | null;
  receiptDocumentType: string | null;
  amount: number;
  date: string;
  fileNo?: string | null;
  customerName?: string | null;
  operationNo?: string | null;
  description?: string | null;
};

export type ExpenseFileHakedisWarning = {
  kind: ExpenseHakedisFileKind;
  fileId: string;
  fileNo: string;
  vendorName: string;
  amount: number;
  grantedAt: string | null;
  paid: boolean | null;
};

export type ExpenseDocumentReviewPayload = {
  code: typeof EXPENSE_DOCUMENT_REVIEW_CODE;
  message: string;
  documentDuplicates: ExpenseDocumentDuplicateRow[];
  hakedisWarnings: ExpenseFileHakedisWarning[];
  requiresOverride: true;
};

/** Boşluk yok; büyük harf; baştaki sıfırlar düşer (25 ≡ 025). */
export function normalizeExpenseDocumentNo(raw: string | null | undefined): string {
  const compact = String(raw ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, '');
  if (!compact) return '';
  // Harf+rakam karışıkta yalnız baştaki sıfırları düş (A025 → A025; 025 → 25; 000 → 0)
  if (/^0+\d*$/.test(compact)) {
    const stripped = compact.replace(/^0+/, '');
    return stripped || '0';
  }
  if (/^0+[A-ZÇĞİÖŞÜ0-9]*$/i.test(compact) && /^\d+$/.test(compact.replace(/^0+/, '') || '0')) {
    const stripped = compact.replace(/^0+/, '');
    return stripped || '0';
  }
  // Saf rakam: baştaki sıfırları düş
  if (/^\d+$/.test(compact)) {
    const stripped = compact.replace(/^0+/, '');
    return stripped || '0';
  }
  return compact;
}

export function expenseDocumentNosMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeExpenseDocumentNo(a);
  const right = normalizeExpenseDocumentNo(b);
  return Boolean(left && right && left === right);
}

export function shouldReviewExpenseDocument(input: {
  hasTaxDocument?: boolean | null;
  receiptDocumentNo?: string | null;
}): boolean {
  if (input.hasTaxDocument === false) return false;
  return Boolean(normalizeExpenseDocumentNo(input.receiptDocumentNo));
}

export function expenseDocumentReviewNeeded(input: {
  documentDuplicates: readonly unknown[];
  hakedisWarnings: readonly unknown[];
}): boolean {
  return input.documentDuplicates.length > 0 || input.hakedisWarnings.length > 0;
}

export function buildExpenseDocumentReviewMessage(input: {
  documentDuplicates: readonly unknown[];
  hakedisWarnings: readonly unknown[];
}): string {
  const hasDup = input.documentDuplicates.length > 0;
  const hasHak = input.hakedisWarnings.length > 0;
  if (hasDup && hasHak) {
    return `${EXPENSE_DOCUMENT_DUPLICATE_MESSAGE} ${EXPENSE_FILE_HAKEDIS_WARN_MESSAGE}`;
  }
  if (hasDup) return EXPENSE_DOCUMENT_DUPLICATE_MESSAGE;
  if (hasHak) return EXPENSE_FILE_HAKEDIS_WARN_MESSAGE;
  return '';
}

export function isValidExpenseDocumentOverrideReason(raw: string | null | undefined): boolean {
  return String(raw ?? '').trim().length >= EXPENSE_DOCUMENT_OVERRIDE_REASON_MIN;
}

export function buildExpenseDocumentReviewPayload(input: {
  documentDuplicates: ExpenseDocumentDuplicateRow[];
  hakedisWarnings: ExpenseFileHakedisWarning[];
}): ExpenseDocumentReviewPayload | null {
  if (!expenseDocumentReviewNeeded(input)) return null;
  return {
    code: EXPENSE_DOCUMENT_REVIEW_CODE,
    message: buildExpenseDocumentReviewMessage(input),
    documentDuplicates: input.documentDuplicates,
    hakedisWarnings: input.hakedisWarnings,
    requiresOverride: true,
  };
}
