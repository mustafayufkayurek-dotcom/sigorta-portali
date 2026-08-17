import {
  APPROVAL_WAITING_REPORT_STATUSES,
  isApproval72hExceeded,
  hoursSince,
} from '@sigorta/shared';

export const APPROVAL_72H_NOTIFY_TYPE = 'approval_72h_exceeded';

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
