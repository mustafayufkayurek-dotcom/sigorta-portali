import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import {
  APPROVAL_72H_NOTIFY_TYPE,
  buildApproval72hNotification,
  filterExceededCandidates,
  isWaitingReportStatus,
  resolveNotifyUserIds,
  type Approval72hCandidate,
} from './approval-72h.rule';
import { APPROVAL_WAITING_REPORT_STATUSES } from '@sigorta/shared';

@Injectable()
export class Approval72hScheduler {
  private readonly logger = new Logger(Approval72hScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Saatlik + manuel tetik için public entry */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCheck(): Promise<{ notified: number; scanned: number }> {
    if (this.running) {
      this.logger.warn('72s onay kontrolü zaten çalışıyor, atlandı');
      return { notified: 0, scanned: 0 };
    }
    this.running = true;
    try {
      return await this.runCheck();
    } finally {
      this.running = false;
    }
  }

  async runCheck(now = new Date()): Promise<{ notified: number; scanned: number }> {
    const waitingReports = await this.prisma.repairReport.findMany({
      where: { status: { in: [...APPROVAL_WAITING_REPORT_STATUSES] } },
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
          },
        },
      },
      take: 2000,
    });

    const candidates: Approval72hCandidate[] = [];
    for (const report of waitingReports) {
      if (!isWaitingReportStatus(report.status)) continue;
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
      return { notified: 0, scanned: candidates.length };
    }

    const managers = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ADMIN', 'MANAGER', 'manager'] } },
      },
      select: { id: true },
      take: 50,
    });
    const managerIds = managers.map((m) => m.id);

    let notified = 0;
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    for (const row of exceeded) {
      const userIds = resolveNotifyUserIds(row, managerIds);
      const { title, body } = buildApproval72hNotification({
        fileNo: row.fileNo,
        hoursWaiting: row.hoursWaiting,
      });

      for (const userId of userIds) {
        const already = await this.prisma.notification.findFirst({
          where: {
            userId,
            type: APPROVAL_72H_NOTIFY_TYPE,
            relatedEntityId: row.claimFileId,
            createdAt: { gte: dayStart },
          },
          select: { id: true },
        });
        if (already) continue;

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
      `72s onay kontrolü: tarama=${candidates.length}, aşan=${exceeded.length}, bildirim=${notified}`,
    );
    return { notified, scanned: candidates.length };
  }
}
