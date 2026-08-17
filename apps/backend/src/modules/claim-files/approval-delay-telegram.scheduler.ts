import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { hostname } from 'os';
import { PrismaService } from '@/prisma/prisma.service';
import {
  APPROVAL_DELAY_CRITICAL_HOURS,
  APPROVAL_DELAY_TELEGRAM_NOTIFY_TYPE,
  APPROVAL_DELAY_WARNING_HOURS,
  buildApprovalDelayTelegramDigest,
  buildApprovalDelayTelegramPayload,
  resolveApprovalCustomerShortName,
  resolveApprovalDelayNotifyUserIds,
  type ApprovalDelayTelegramRow,
} from './approval-delay-telegram.rule';
import {
  isTelegramApprovalDelayReminderEnabled,
  isTelegramApprovalDelayReminderOffHoursAllowed,
  sendMeridyenTelegramOpsMessage,
} from './telegram-ops-notify';
import { isWithinStaffNotifyWindow } from '@/modules/hr/hr-work-hours.helper';

/**
 * Günde 1 kez — onay 48s+ kritik → Sistem Alarmları + panel (dosya sorumlusu + admin).
 * 09:05 TR. Mesai dışı yok. Kişisel Telegram chat id yok; grup kanalı + in-app.
 */
@Injectable()
export class ApprovalDelayTelegramScheduler {
  private readonly logger = new Logger(ApprovalDelayTelegramScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('5 9 * * *', {
    name: 'approval-delay-telegram-reminder',
    timeZone: 'Europe/Istanbul',
  })
  async handleDailyDigest() {
    if (this.running) {
      return { sent: false, critical48h: 0, total24h: 0, skippedReason: 'already_running' };
    }
    this.running = true;
    try {
      return await this.runDigest();
    } finally {
      this.running = false;
    }
  }

  async runDigest(
    now = new Date(),
    opts?: { dryRun?: boolean },
  ): Promise<{
    sent: boolean;
    critical48h: number;
    total24h: number;
    inAppNotified?: number;
    skippedReason?: string;
    previewText?: string;
  }> {
    if (!isTelegramApprovalDelayReminderEnabled()) {
      this.logger.debug('TELEGRAM_APPROVAL_DELAY_REMINDER_ENABLED kapalı — atlandı');
      return { sent: false, critical48h: 0, total24h: 0, skippedReason: 'disabled' };
    }

    const offHoursAllowed = isTelegramApprovalDelayReminderOffHoursAllowed();
    if (!isWithinStaffNotifyWindow(now) && !offHoursAllowed) {
      this.logger.log('Mesai dışı — onay gecikmesi Telegram uyarısı gönderilmedi');
      return {
        sent: false,
        critical48h: 0,
        total24h: 0,
        skippedReason: 'outside_work_hours',
      };
    }

    const reports = await this.prisma.repairReport.findMany({
      where: {
        status: { in: ['pending_approval', 'sent_for_external_approval', 'submitted'] },
        claimFile: { currentStatus: { isClosedState: false } },
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        claimFileId: true,
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            assignedOfficeUserId: true,
            currentResponsibleUserId: true,
            customer: {
              select: {
                shortName: true,
                companyName: true,
                fullName: true,
              },
            },
          },
        },
        approvalHistory: {
          where: { action: { in: ['pending_approval', 'sent_for_external_approval'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, action: true },
        },
        externalApprovals: {
          where: { status: 'pending' },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });

    type Acc = ApprovalDelayTelegramRow & { claimFileId: string };
    const byClaim = new Map<string, Acc>();

    for (const report of reports) {
      let waitingSince: Date;
      let category: ApprovalDelayTelegramRow['category'];

      if (report.status === 'pending_approval') {
        const hist = report.approvalHistory.find((h) => h.action === 'pending_approval');
        waitingSince = hist?.createdAt ?? report.updatedAt;
        category = 'pending_approval';
      } else if (report.status === 'sent_for_external_approval') {
        const ext = report.externalApprovals[0];
        const hist = report.approvalHistory.find((h) => h.action === 'sent_for_external_approval');
        waitingSince = ext?.sentAt ?? hist?.createdAt ?? report.updatedAt;
        category = 'external_approval';
      } else if (report.status === 'submitted') {
        waitingSince = report.updatedAt;
        category = 'submitted';
      } else {
        continue;
      }

      const hoursWaiting = (now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60);
      if (hoursWaiting < APPROVAL_DELAY_WARNING_HOURS) continue;

      const row: Acc = {
        claimFileId: report.claimFileId,
        fileNo: report.claimFile.fileNo,
        customerShortName: resolveApprovalCustomerShortName(report.claimFile.customer ?? {}),
        hoursWaiting,
        category,
        assignedOfficeUserId: report.claimFile.assignedOfficeUserId,
        currentResponsibleUserId: report.claimFile.currentResponsibleUserId,
      };
      const existing = byClaim.get(report.claimFileId);
      if (!existing || row.hoursWaiting > existing.hoursWaiting) {
        byClaim.set(report.claimFileId, row);
      }
    }

    const digest = buildApprovalDelayTelegramDigest(Array.from(byClaim.values()));
    const payload = buildApprovalDelayTelegramPayload(digest, {
      at: now,
      host: hostname(),
    });

    if (!payload) {
      return {
        sent: false,
        critical48h: digest.critical48h,
        total24h: digest.total24h,
        skippedReason:
          digest.total24h > 0 ? 'no_critical_48h' : 'nothing_pending',
      };
    }

    if (opts?.dryRun) {
      this.logger.log(`DRY_RUN onay gecikmesi Telegram özeti\n${payload.text}`);
      return {
        sent: false,
        critical48h: digest.critical48h,
        total24h: digest.total24h,
        skippedReason: 'dry_run',
        previewText: payload.text,
      };
    }

    const result = await sendMeridyenTelegramOpsMessage(payload.text);
    if (!result.ok) {
      this.logger.warn(`Telegram onay gecikmesi özeti gönderilemedi: ${result.reason}`);
      return {
        sent: false,
        critical48h: digest.critical48h,
        total24h: digest.total24h,
        skippedReason: result.reason,
        previewText: payload.text,
      };
    }

    const inAppNotified = await this.notifyOfficeAndAdmins(digest.criticalItems, payload, now);

    this.logger.log(
      `Telegram onay gecikmesi özeti gönderildi · critical48=${digest.critical48h} total24=${digest.total24h} inApp=${inAppNotified} (eşik kritik=${APPROVAL_DELAY_CRITICAL_HOURS}s)`,
    );
    return {
      sent: true,
      critical48h: digest.critical48h,
      total24h: digest.total24h,
      inAppNotified,
      previewText: payload.text,
    };
  }

  /** Panel çanı: ilgili hasar dosya sorumlusu + admin */
  private async notifyOfficeAndAdmins(
    items: ReturnType<typeof buildApprovalDelayTelegramDigest>['criticalItems'],
    payload: NonNullable<ReturnType<typeof buildApprovalDelayTelegramPayload>>,
    now: Date,
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ADMIN'] } },
      },
      select: { id: true },
      take: 50,
    });
    const adminIds = admins.map((a) => a.id);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    let notified = 0;
    for (const item of items) {
      if (!item.claimFileId) continue;
      const userIds = resolveApprovalDelayNotifyUserIds(item, adminIds);
      const title = 'Onay Gecikmesi';
      const body = formatLineForInApp(item.fileNo, item.customerShortName, payload.action);

      for (const userId of userIds) {
        const already = await this.prisma.notification.findFirst({
          where: {
            userId,
            type: APPROVAL_DELAY_TELEGRAM_NOTIFY_TYPE,
            relatedEntityId: item.claimFileId,
            createdAt: { gte: dayStart },
          },
          select: { id: true },
        });
        if (already) continue;

        await this.prisma.notification.create({
          data: {
            userId,
            type: APPROVAL_DELAY_TELEGRAM_NOTIFY_TYPE,
            title,
            body,
            channel: 'in_app',
            status: 'unread',
            relatedEntityType: 'claim_file',
            relatedEntityId: item.claimFileId,
          },
        });
        notified += 1;
      }
    }
    return notified;
  }
}

function formatLineForInApp(fileNo: string, customerShortName: string, action: string): string {
  return `${fileNo} Nolu ${customerShortName} dosya onayı gecikti. ${action}`;
}
