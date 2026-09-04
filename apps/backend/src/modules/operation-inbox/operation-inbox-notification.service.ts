import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppUrl } from '@/common/utils/app-url';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { yeniIhbarSubject } from '@/modules/notifications/email/email.template';
import { buildInboxIhbarEmailTemplate } from './inbox-ihbar-email';

export type InboxNotificationType =
  | 'inbox_assigned'
  | 'inbox_unowned_escalation'
  | 'inbox_new_ihbar';

@Injectable()
export class OperationInboxNotificationService {
  private readonly logger = new Logger(OperationInboxNotificationService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly emailService?: EmailService,
  ) {
    this.appUrl = resolveAppUrl(this.config);
  }

  private async createInApp(params: {
    userId: string;
    type: InboxNotificationType;
    title: string;
    body: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          channel: 'in_app',
          status: 'unread',
          relatedEntityType: params.relatedEntityId ? 'inbound_message' : null,
          relatedEntityId: params.relatedEntityId ?? null,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`In-app bildirim oluşturulamadı (${params.type}): ${msg}`);
    }
  }

  async notifyAssigned(params: {
    userId: string;
    userEmail?: string | null;
    messageId: string;
    subject: string;
    mailboxLabel: string;
  }): Promise<void> {
    const title = 'Gelen Kutu Ataması';
    const body = `${params.mailboxLabel} kutusundan gelen "${params.subject}" mesajı size atandı.`;

    await this.createInApp({
      userId: params.userId,
      type: 'inbox_assigned',
      title,
      body,
      relatedEntityId: params.messageId,
    });

    if (this.emailService && params.userEmail) {
      await this.emailService.sendIfPreferred(
        params.userId,
        'claimAssignment',
        params.userEmail,
        title,
        {
          title,
          preheader: body,
          rows: [
            { label: 'Konu', value: params.subject },
            { label: 'Kutu', value: params.mailboxLabel },
          ],
          actionUrl: `${this.appUrl}/panel/operasyon/gelen-kutusu`,
          actionLabel: 'Gelen Kutusunu Aç',
        },
      ).catch(() => undefined);
    }
  }

  async notifyUnownedEscalation(params: {
    messageId: string;
    subject: string;
    mailboxLabel: string;
    urgency: 'HIGH' | 'NORMAL';
    reason: string;
  }): Promise<void> {
    const managers = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'manager'] } },
      },
      select: { id: true, email: true },
    });

    if (!managers.length) return;

    const title = params.urgency === 'HIGH'
      ? 'Acil — Sahiplenilmemiş İhbar'
      : 'Sahiplenilmemiş Gelen Kutu Mesajı';
    const body = `${params.mailboxLabel}: "${params.subject}" — ${params.reason}`;

    for (const mgr of managers) {
      await this.createInApp({
        userId: mgr.id,
        type: 'inbox_unowned_escalation',
        title,
        body,
        relatedEntityId: params.messageId,
      });

      if (this.emailService && mgr.email) {
        await this.emailService.sendIfPreferred(
          mgr.id,
          'managerInstruction',
          mgr.email,
          title,
          {
            title,
            preheader: body,
            rows: [
              { label: 'Konu', value: params.subject },
              { label: 'Kutu', value: params.mailboxLabel },
              { label: 'Neden', value: params.reason },
            ],
            actionUrl: `${this.appUrl}/panel/operasyon/gelen-kutusu`,
            actionLabel: 'Gelen Kutusunu Aç',
          },
        ).catch(() => undefined);
      }
    }
  }

  async notifyNewIhbarFromInbox(params: {
    userId: string;
    userEmail?: string | null;
    messageId: string;
    subject: string;
    fileNo: string;
    fileType: 'hasar' | 'acil';
    fileId: string;
  }): Promise<void> {
    const fileLabel = params.fileType === 'hasar' ? 'Hasar Dosyası' : 'Acil Yardım Dosyası';
    const title = 'Yeni İhbar Dosyası';
    const body = `${fileLabel} ${params.fileNo} açıldı ve size atandı.`;

    await this.createInApp({
      userId: params.userId,
      type: 'inbox_new_ihbar',
      title,
      body,
      relatedEntityId: params.messageId,
    });

    if (this.emailService && params.userEmail) {
      const actionUrl =
        params.fileType === 'hasar'
          ? `${this.appUrl}/panel/hasar-dosyalari/${params.fileId}`
          : `${this.appUrl}/panel/acil-yardim/${params.fileId}`;

      let customerLongName = '';
      let insuranceCompanyName: string | null = null;
      let assistantCompanyName: string | null = null;
      let fileSubject: string | null = null;
      let insuredName: string | null = null;
      let city: string | null = null;
      let district: string | null = null;
      let address: string | null = null;
      let notificationAt: Date | null = null;
      let expertOfficeShortName = '';

      if (params.fileType === 'hasar') {
        const claim = await this.prisma.claimFile.findUnique({
          where: { id: params.fileId },
          select: {
            notificationDate: true,
            createdAt: true,
            lossType: true,
            insuredName: true,
            customer: { select: { fullName: true, companyName: true, shortName: true, subType: true } },
            insuranceCompany: { select: { name: true } },
            claimSubject: { select: { name: true } },
            propertyAddress: { select: { addressLine: true, city: true, district: true } },
          },
        }).catch(() => null);
        customerLongName = (claim?.customer?.companyName || claim?.customer?.fullName || '').trim();
        const customerSub = String(claim?.customer?.subType || '');
        if (customerSub === 'eksper_firmasi' || customerSub === 'eksper') {
          expertOfficeShortName = String(claim?.customer?.shortName || '').trim();
        }
        insuranceCompanyName = claim?.insuranceCompany?.name ?? null;
        fileSubject = claim?.claimSubject?.name || claim?.lossType || null;
        insuredName = claim?.insuredName ?? null;
        city = claim?.propertyAddress?.city ?? null;
        district = claim?.propertyAddress?.district ?? null;
        address = claim?.propertyAddress?.addressLine ?? null;
        notificationAt = claim?.notificationDate ?? claim?.createdAt ?? null;
      } else {
        const acil = await this.prisma.emergencyCase.findUnique({
          where: { id: params.fileId },
          select: {
            fileDate: true,
            createdAt: true,
            issueType: true,
            customerName: true,
            address: true,
            city: true,
            district: true,
            customer: { select: { fullName: true, companyName: true } },
          },
        }).catch(() => null);
        customerLongName = (acil?.customer?.companyName || acil?.customer?.fullName || acil?.customerName || '').trim();
        assistantCompanyName = customerLongName || null;
        fileSubject = acil?.issueType ?? null;
        city = acil?.city ?? null;
        district = acil?.district ?? null;
        address = acil?.address ?? null;
        notificationAt = acil?.fileDate ?? acil?.createdAt ?? null;
      }

      await this.emailService.sendIfPreferred(
        params.userId,
        'newClaimFile',
        params.userEmail,
        yeniIhbarSubject(expertOfficeShortName),
        buildInboxIhbarEmailTemplate({
          fileType: params.fileType,
          fileNo: params.fileNo,
          notificationAt,
          insuranceCompanyName,
          assistantCompanyName,
          customerLongName,
          fileSubject,
          insuredName,
          city,
          district,
          address,
          actionUrl,
          portalUrl: this.appUrl,
        }),
      ).catch(() => undefined);
    }
  }
}
