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

/** Kilitli / onay sürecindeki rapor: yeni taslak açılabilir. Taslak ve red zaten düzenlenir. */
export const REPAIR_REPORT_REVISABLE_STATUSES = [
  'submitted',
  'pending_approval',
  'approved',
  'sent_for_external_approval',
  'externally_approved',
  'externally_rejected',
] as const;

export type RepairReportRevisableStatus = (typeof REPAIR_REPORT_REVISABLE_STATUSES)[number];

export function canStartRepairReportRevisionFromStatus(status: string | null | undefined): boolean {
  return REPAIR_REPORT_REVISABLE_STATUSES.includes(status as RepairReportRevisableStatus);
}

/** Onay bekleyen kaynak revizyonda kapanır; eksper/sigorta eski linki eski raporu onaylamasın. */
export const REPAIR_REPORT_STATUSES_CLOSED_ON_REVISE = [
  'submitted',
  'pending_approval',
  'sent_for_external_approval',
] as const;

export function repairReportClosesOnRevise(status: string | null | undefined): boolean {
  return (REPAIR_REPORT_STATUSES_CLOSED_ON_REVISE as readonly string[]).includes(status ?? '');
}

export const REPAIR_REPORT_MAX_REVISION_MESSAGE =
  'Revizyon Geçmişi 0–3 ile sınırlıdır; 4. Revizyon Oluşturulamaz';
