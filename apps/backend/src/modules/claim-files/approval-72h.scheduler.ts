import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { APPROVAL_72H_MS, APPROVAL_WAITING_REPORT_STATUSES } from '@sigorta/shared';
import {
  APPROVAL_72H_NOTIFY_TYPE,
  buildApproval72hNotification,
  filterExceededCandidates,
  isWaitingReportStatus,
  pickNewestRepairReport,
  resolveNotifyUserIds,
  shouldSendApproval72hReminder,
  type Approval72hCandidate,
} from './approval-72h.rule';

@Injectable()
export class Approval72hScheduler {
  private readonly logger = new Logger(Approval72hScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Saatlik + manuel tetik için public entry */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCheck(): Promise<{
    notified: number;
    scanned: number;
    customerEmails: number;
    customerEmailSkipped: number;
  }> {
    if (this.running) {
      this.logger.warn('72s onay kontrolü zaten çalışıyor, atlandı');
      return { notified: 0, scanned: 0, customerEmails: 0, customerEmailSkipped: 0 };
    }
    this.running = true;
    try {
      return await this.runCheck();
    } finally {
      this.running = false;
    }
  }

  async runCheck(now = new Date()): Promise<{
    notified: number;
    scanned: number;
    customerEmails: number;
    customerEmailSkipped: number;
  }> {
    const waitingReports = await this.prisma.repairReport.findMany({
      where: {
        status: { in: [...APPROVAL_WAITING_REPORT_STATUSES] },
        claimFile: { currentStatus: { isClosedState: false } },
      },
      select: {
        id: true,
        reportNo: true,
        status: true,
        updatedAt: true,
        claimFileId: true,
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            assignedOfficeUserId: true,
            assignedFieldUserId: true,
            currentResponsibleUserId: true,
            currentStatus: { select: { code: true, isClosedState: true } },
          },
        },
      },
      take: 2000,
    });

    const candidates: Approval72hCandidate[] = [];
    const claimIds = [...new Set(waitingReports.map((r) => r.claimFile.id))];
    const allReports = claimIds.length
      ? await this.prisma.repairReport.findMany({
          where: { claimFileId: { in: claimIds } },
          select: {
            id: true,
            claimFileId: true,
            status: true,
            versionNo: true,
            createdAt: true,
            externalApprovals: {
              orderBy: { sentAt: 'desc' },
              take: 20,
              select: { status: true },
            },
          },
        })
      : [];
    const reportsByClaim = new Map<string, typeof allReports>();
    for (const row of allReports) {
      const list = reportsByClaim.get(row.claimFileId) ?? [];
      list.push(row);
      reportsByClaim.set(row.claimFileId, list);
    }
    const waitingById = new Map(waitingReports.map((r) => [r.id, r]));

    for (const claimId of claimIds) {
      const sample = waitingReports.find((r) => r.claimFile.id === claimId);
      const claim = sample?.claimFile;
      if (!claim) continue;
      const snapshots = (reportsByClaim.get(claimId) ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        versionNo: r.versionNo,
        createdAt: r.createdAt,
        latestExternalApprovalStatus: r.externalApprovals.some((a) => a.status === 'approved')
          ? 'approved'
          : (r.externalApprovals[0]?.status ?? null),
      }));
      if (
        !shouldSendApproval72hReminder({
          claimClosed: Boolean(claim.currentStatus?.isClosedState),
          claimStatusCode: claim.currentStatus?.code,
          reports: snapshots,
        })
      ) {
        continue;
      }
      const newest = pickNewestRepairReport(snapshots);
      const report = newest ? waitingById.get(newest.id) : undefined;
      if (!report || !isWaitingReportStatus(report.status)) continue;

      const awaitingHistory = await this.prisma.reportApprovalHistory.findFirst({
        where: { reportId: report.id, action: { in: ['pending_approval', 'submitted'] } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const awaitingSince = awaitingHistory?.createdAt ?? report.updatedAt;
      candidates.push({
        claimFileId: report.claimFile.id,
        fileNo: report.claimFile.fileNo,
        reportId: report.id,
        reportNo: report.reportNo,
        awaitingSince,
        assignedOfficeUserId: report.claimFile.assignedOfficeUserId,
        assignedFieldUserId: report.claimFile.assignedFieldUserId,
        currentResponsibleUserId: report.claimFile.currentResponsibleUserId,
      });
    }

    const exceeded = filterExceededCandidates(candidates, now);
    if (exceeded.length === 0) {
      this.logger.log(`72s onay kontrolü: tarama=${candidates.length}, aşan=0`);
      return { notified: 0, scanned: candidates.length, customerEmails: 0, customerEmailSkipped: 0 };
    }

    let notified = 0;
    const promptSince = new Date(now.getTime() - APPROVAL_72H_MS);

    for (const row of exceeded) {
      const userIds = resolveNotifyUserIds(row);
      if (userIds.length === 0) continue;

      const recentPrompt = await this.prisma.notification.findFirst({
        where: {
          type: APPROVAL_72H_NOTIFY_TYPE,
          relatedEntityId: row.claimFileId,
          createdAt: { gte: promptSince },
        },
        select: { id: true },
      });
      if (recentPrompt) continue;

      const { title, body } = buildApproval72hNotification({
        fileNo: row.fileNo,
        hoursWaiting: row.hoursWaiting,
      });

      for (const userId of userIds) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: APPROVAL_72H_NOTIFY_TYPE,
            title,
            body,
            channel: 'in_app',
            status: 'unread',
            relatedEntityType: 'claim_file',
            relatedEntityId: row.claimFileId,
          },
        });
        notified += 1;
      }
    }

    this.logger.log(
      `72s onay kontrolü: tarama=${candidates.length}, aşan=${exceeded.length}, dosyaSorumlusuBildirim=${notified}, otomatikMail=0`,
    );
    return { notified, scanned: candidates.length, customerEmails: 0, customerEmailSkipped: 0 };
  }
}
