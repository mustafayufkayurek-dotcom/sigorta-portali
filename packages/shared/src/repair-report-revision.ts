/** Onarım raporu revizyon numaralandırması: 0 → 3 (4. adım yok). */
export const REPAIR_REPORT_INITIAL_VERSION = 0;
export const REPAIR_REPORT_MAX_VERSION = 3;
export const REPAIR_REPORT_VERSION_SLOTS = [0, 1, 2, 3] as const;

export function canCreateRepairReportRevision(maxVersionNo: number): boolean {
  return maxVersionNo < REPAIR_REPORT_MAX_VERSION;
}

export function nextRepairReportVersionNo(maxVersionNo: number): number | null {
  if (!canCreateRepairReportRevision(maxVersionNo)) return null;
  return maxVersionNo + 1;
}

export function isRepairReportRevision(versionNo: number | null | undefined): boolean {
  return (versionNo ?? REPAIR_REPORT_INITIAL_VERSION) > REPAIR_REPORT_INITIAL_VERSION;
}

export const REPAIR_REPORT_MAX_REVISION_MESSAGE =
  'Revizyon Geçmişi 0–3 ile sınırlıdır; 4. Revizyon Oluşturulamaz';
