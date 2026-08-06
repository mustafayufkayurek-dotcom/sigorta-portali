import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import {
  APPROVAL_72H_NOTIFY_TYPE,
  buildApproval72hNotification,
  filterExceededCandidates,
  isWaitingReportStatus,
  resolveNotifyUserIds,
  type Approval72hCandidate,
} from './approval-72h.rule';
import { resolveApproval72hCustomerEmailPayload } from './approval-72h-customer-email.rule';
import { APPROVAL_WAITING_REPORT_STATUSES } from '@sigorta/shared';

const APPROVAL_72H_CUSTOMER_EMAIL_TYPE = 'approval_72h_customer_email';

@Injectable()
export class Approval72hScheduler {
  private readonly logger = new Logger(Approval72hScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly claimEventEmail: ClaimEventEmailService,
  ) {}

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
            insuredName: true,
            assignedOfficeUserId: true,
            assignedFieldUserId: true,
            currentResponsibleUserId: true,
            propertyAddress: {
              select: { city: true, district: true },
            },
            customer: {
              select: {
                id: true,
                email: true,
                shortName: true,
                companyName: true,
                fullName: true,
                firstName: true,
                lastName: true,
                contactFirstName: true,
                contactLastName: true,
                contacts: {
                  select: { email: true, isPrimary: true },
                  take: 10,
                },
              },
            },
            insuranceCompany: {
              select: {
                name: true,
                contactEmail: true,
              },
            },
          },
        },
      },
      take: 2000,
    });

    const candidates: Approval72hCandidate[] = [];
    const claimSourceById = new Map<string, (typeof waitingReports)[number]['claimFile']>();

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
      claimSourceById.set(report.claimFile.id, report.claimFile);
    }

    const exceeded = filterExceededCandidates(candidates, now);
    if (exceeded.length === 0) {
      this.logger.log(`72s onay kontrolü: tarama=${candidates.length}, aşan=0`);
      return { notified: 0, scanned: candidates.length, customerEmails: 0, customerEmailSkipped: 0 };
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
    let customerEmails = 0;
    let customerEmailSkipped = 0;
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

      // Müşteri e-posta hatırlatması — yalnızca doğrulanmış müşteri + eksiksiz dosya özeti
      const alreadyMail = await this.prisma.notification.findFirst({
        where: {
          type: APPROVAL_72H_CUSTOMER_EMAIL_TYPE,
          relatedEntityId: row.claimFileId,
          createdAt: { gte: dayStart },
        },
        select: { id: true },
      });
      if (alreadyMail) continue;

      const claim = claimSourceById.get(row.claimFileId);
      const resolved = resolveApproval72hCustomerEmailPayload({
        fileNo: claim?.fileNo ?? row.fileNo,
        insuredName: claim?.insuredName,
        customer: claim?.customer,
        insuranceCompany: claim?.insuranceCompany,
        propertyAddress: claim?.propertyAddress,
      });

      if (!resolved.ok) {
        customerEmailSkipped += 1;
        this.logger.warn(
          `72s müşteri maili atlandı (${row.fileNo}): ${resolved.reason}`,
        );
        continue;
      }

      const result = await this.claimEventEmail.onApproval72hCustomerReminder({
        recipientEmail: resolved.payload.recipientEmail,
        recipientName: resolved.payload.recipientName,
        fileNo: resolved.payload.fileNo,
        customerName: resolved.payload.customerName,
        insuranceCompanyName: resolved.payload.insuranceCompanyName,
        insuredName: resolved.payload.insuredName,
        cityDistrict: resolved.payload.cityDistrict,
        hoursWaiting: row.hoursWaiting,
        claimFileId: row.claimFileId,
      });

      if (!result.sent) {
        customerEmailSkipped += 1;
        this.logger.warn(
          `72s müşteri maili gönderilemedi (${row.fileNo}): ${result.errorMsg ?? 'bilinmeyen'}`,
        );
        continue;
      }

      customerEmails += 1;
      const dedupeUserId = row.assignedOfficeUserId
        || row.currentResponsibleUserId
        || managerIds[0];
      if (dedupeUserId) {
        await this.prisma.notification.create({
          data: {
            userId: dedupeUserId,
            type: APPROVAL_72H_CUSTOMER_EMAIL_TYPE,
            title: 'Müşteri Onay Hatırlatması Gönderildi',
            body: `${resolved.payload.fileNo} → ${resolved.payload.recipientEmail}`,
            channel: 'email',
            status: 'read',
            relatedEntityType: 'claim_file',
            relatedEntityId: row.claimFileId,
          },
        });
      }
    }

    this.logger.log(
      `72s onay kontrolü: tarama=${candidates.length}, aşan=${exceeded.length}, bildirim=${notified}, müşteriMail=${customerEmails}, mailAtlandı=${customerEmailSkipped}`,
    );
    return { notified, scanned: candidates.length, customerEmails, customerEmailSkipped };
  }
}
