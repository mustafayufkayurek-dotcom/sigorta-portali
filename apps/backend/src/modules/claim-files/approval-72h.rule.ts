import {
  APPROVAL_WAITING_REPORT_STATUSES,
  isApproval72hExceeded,
  hoursSince,
} from '@sigorta/shared';

export const APPROVAL_72H_NOTIFY_TYPE = 'approval_72h_exceeded';

/** Dosya onayı alınmış / iş onarıma geçmiş — eksper hatırlatması kesilir. */
export const CLAIM_CODES_APPROVAL_ALREADY_TAKEN = [
  'budget_approved',
  'repair_planning',
  'repair_in_progress',
  'repair_completed',
  'invoice_pending',
  'invoice_submitted',
  'payment_pending',
  'partially_collected',
  'closed',
  'completed',
  'cancelled',
] as const;

export type Approval72hReportSnapshot = {
  id: string;
  status: string;
  versionNo: number;
  createdAt: Date | string;
  latestExternalApprovalStatus?: string | null;
};

export function pickNewestRepairReport<T extends { versionNo: number; createdAt: Date | string }>(
  reports: T[],
): T | null {
  if (!reports.length) return null;
  return [...reports].sort((a, b) => {
    if (b.versionNo !== a.versionNo) return b.versionNo - a.versionNo;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

/**
 * Hatırlatma yalnız gerçekten onay bekleyen açık işe gider.
 * Eski bekleyen satır, kapalı dosya veya alınmış onay maili düşürmez.
 */
export function shouldSendApproval72hReminder(input: {
  claimClosed?: boolean;
  claimStatusCode?: string | null;
  reports: Approval72hReportSnapshot[];
}): boolean {
  const code = String(input.claimStatusCode ?? '').trim().toLowerCase();
  if (input.claimClosed) return false;
  if ((CLAIM_CODES_APPROVAL_ALREADY_TAKEN as readonly string[]).includes(code)) {
    return false;
  }

  const newest = pickNewestRepairReport(input.reports);
  if (!newest) return false;
  if (!isWaitingReportStatus(newest.status)) return false;

  const ext = String(newest.latestExternalApprovalStatus ?? '').trim().toLowerCase();
  if (ext === 'approved') return false;

  return true;
}

export type Approval72hCandidate = {
  claimFileId: string;
  fileNo: string;
  reportId: string;
  reportNo: string;
  awaitingSince: Date;
  assignedOfficeUserId: string | null;
  assignedFieldUserId: string | null;
  currentResponsibleUserId: string | null;
};

export function filterExceededCandidates(
  rows: Approval72hCandidate[],
  now = new Date(),
): Array<Approval72hCandidate & { hoursWaiting: number }> {
  return rows
    .filter((r) => isApproval72hExceeded(r.awaitingSince, now))
    .map((r) => ({
      ...r,
      hoursWaiting: hoursSince(r.awaitingSince, now) ?? 72,
    }));
}

export function resolveNotifyUserIds(row: Approval72hCandidate, managerIds: string[]): string[] {
  const ids = new Set<string>();
  if (row.assignedOfficeUserId) ids.add(row.assignedOfficeUserId);
  if (row.assignedFieldUserId) ids.add(row.assignedFieldUserId);
  if (row.currentResponsibleUserId) ids.add(row.currentResponsibleUserId);
  for (const m of managerIds) ids.add(m);
  return [...ids];
}

export function isWaitingReportStatus(status: string): boolean {
  return (APPROVAL_WAITING_REPORT_STATUSES as readonly string[]).includes(status);
}

export function buildApproval72hNotification(params: {
  fileNo: string;
  hoursWaiting: number;
}): { title: string; body: string } {
  return {
    title: '72 Saat Onay Uyarısı',
    body: `${params.fileNo} dosyasında onay ${params.hoursWaiting} saattir bekliyor. Onay Talep Et.`,
  };
}
