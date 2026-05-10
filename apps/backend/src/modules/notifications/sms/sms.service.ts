import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ISmsProvider, SMS_PROVIDER } from './sms-provider.interface';
import { ConfigService } from '@nestjs/config';

export type SmsNotificationType = 'appointment_sms' | 'appointment_whatsapp' | 'claim_assignment';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly providerName: string;

  constructor(
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISmsProvider,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.providerName = this.config.get<string>('SMS_PROVIDER', 'console');
  }

  async send(
    userId: string,
    to: string,
    message: string,
    type: SmsNotificationType,
    relatedEntityId?: string,
  ): Promise<void> {
    await this.smsProvider.send(to, message);

    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: type === 'appointment_sms' ? 'SMS Gönderildi' : 'WhatsApp Bildirimi',
        body: message,
        channel: type === 'appointment_sms' ? 'sms' : 'whatsapp',
        status: 'sent',
        relatedEntityType: relatedEntityId ? 'appointment' : null,
        relatedEntityId: relatedEntityId ?? null,
      },
    });
  }

  /**
   * Sigortalıya (müşteriye) atama bildirim SMS'i gönderir.
   * Hata durumunda sessizce fail olur, SmsLog'a kaydeder.
   */
  async sendCustomerAssignmentSms(params: {
    to: string;
    claimFileId: string;
    templateContent: string;
  }): Promise<void> {
    const { to, claimFileId, templateContent } = params;

    const logData = {
      to,
      message: templateContent,
      provider: this.providerName,
      claimFileId,
    };

    try {
      await this.smsProvider.send(to, templateContent);

      await this.prisma.smsLog.create({
        data: {
          ...logData,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log(`[SmsService] Atama SMS gönderildi → ${to} (dosya: ${claimFileId})`);
    } catch (err: any) {
      this.logger.warn(`[SmsService] Atama SMS gönderilemedi → ${to}: ${err?.message}`);

      await this.prisma.smsLog.create({
        data: {
          ...logData,
          status: 'failed',
          errorMsg: err?.message ?? 'Bilinmeyen hata',
        },
      });
      // Sessiz fail — dosya atama işlemini bloklama
    }
  }

  /**
   * Test SMS gönderimi
   */
  async sendTestSms(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.smsProvider.send(to, message);

      await this.prisma.smsLog.create({
        data: {
          to,
          message,
          provider: this.providerName,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      return { success: true };
    } catch (err: any) {
      await this.prisma.smsLog.create({
        data: {
          to,
          message,
          provider: this.providerName,
          status: 'failed',
          errorMsg: err?.message ?? 'Bilinmeyen hata',
        },
      });

      return { success: false, error: err?.message };
    }
  }

  /**
   * Son SMS loglarını getirir
   */
  async getLogs(limit = 50) {
    return this.prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  buildWhatsAppUrl(phone: string | undefined, message: string): string {
    const recipient = phone ? `90${phone.replace(/\D/g, '')}` : '';
    return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  }
}
