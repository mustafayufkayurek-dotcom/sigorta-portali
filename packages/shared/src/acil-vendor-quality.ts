/** Acil kayıtlı tedarikçi — memnuniyet / maliyet olumsuz mu? */

export const ACIL_VENDOR_SATISFACTION_WARN = 3;
export const ACIL_VENDOR_COMPOSITE_WARN = 40;
/** Aynı olumsuz tedarikçiyle 2. çalışma → yöneticiye rapor. */
export const ACIL_NEGATIVE_VENDOR_STRIKE_LIMIT = 2;

/** priorOtherAssignments = bu dosya hariç aynı tedarikçiye Acil atama sayısı. */
export function shouldReportAcilNegativeVendorStrike(priorOtherAssignments: number): boolean {
  return priorOtherAssignments + 1 >= ACIL_NEGATIVE_VENDOR_STRIKE_LIMIT;
}

export function isAcilVendorQualityWarning(input: {
  avgServiceScore?: number | null;
  compositeScore?: number | null;
  completedFileCount?: number | null;
}): boolean {
  const score = input.avgServiceScore;
  const composite = input.compositeScore;
  const completed = input.completedFileCount ?? 0;
  const hasQuality = score != null && Number.isFinite(score);
  const hasHistory = completed > 0;
  if (!hasQuality && !hasHistory) return false;
  if (hasQuality && score < ACIL_VENDOR_SATISFACTION_WARN) return true;
  if (hasHistory && composite != null && Number.isFinite(composite) && composite < ACIL_VENDOR_COMPOSITE_WARN) {
    return true;
  }
  return false;
}
