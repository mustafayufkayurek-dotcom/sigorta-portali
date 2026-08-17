import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppUrl } from '@/common/utils/app-url';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/notifications/email/email.service';

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
    const title = 'E-postadan Yeni İhbar Dosyası';
    const body = `"${params.subject}" e-postasından ${fileLabel} ${params.fileNo} açıldı ve size atandı.`;

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

      await this.emailService.sendIfPreferred(
        params.userId,
        'newClaimFile',
        params.userEmail,
        title,
        {
          title,
          preheader: body,
          rows: [
            { label: 'Dosya No', value: params.fileNo },
            { label: 'E-posta Konusu', value: params.subject },
          ],
          actionUrl,
          actionLabel: 'Dosyayı Görüntüle',
        },
      ).catch(() => undefined);
    }
  }
}
