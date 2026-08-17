import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InboundMailbox } from '@prisma/client';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { GraphAuthService } from './graph-auth.service';
import { GraphMailSyncService } from './graph-mail-sync.service';

@Injectable()
export class GraphMailSendService {
  private readonly logger = new Logger(GraphMailSendService.name);
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';

  constructor(
    private readonly http: HttpService,
    private readonly graphAuth: GraphAuthService,
    private readonly graphMailSync: GraphMailSyncService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async sendReply(
    mailbox: InboundMailbox,
    graphMessageId: string,
    body: string,
    replyAll = false,
  ): Promise<void> {
    const config = await this.systemSettings.getM365GraphConfig();
    if (!config.active) {
      throw new BadRequestException(
        'Microsoft 365 entegrasyonu etkin değil. Ayarlar → Entegrasyonlar’dan etkinleştirin.',
      );
    }
    if (!config.tenantId?.trim() || !config.clientId?.trim() || !config.clientSecret?.trim()) {
      throw new BadRequestException(
        'Microsoft 365 kimlik bilgileri eksik. Kiracı kimliği, uygulama kimliği ve gizli anahtar gerekli.',
      );
    }

    const token = await this.graphAuth.getAccessToken({
      tenantId: config.tenantId.trim(),
      clientId: config.clientId.trim(),
      clientSecret: config.clientSecret.trim(),
    });

    const mailboxAddress = this.graphMailSync.resolveMailboxAddress(mailbox, config);
    const encodedUser = encodeURIComponent(mailboxAddress);
    const action = replyAll ? 'replyAll' : 'reply';
    const url = `${this.graphBase}/users/${encodedUser}/messages/${graphMessageId}/${action}`;

    const trimmed = body.trim();
    const contentType = this.isHtml(trimmed) ? 'HTML' : 'Text';
    const payload = {
      message: {
        body: {
          contentType,
          content: trimmed,
        },
      },
    };

    const res = await firstValueFrom(
      this.http.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }),
    );

    if (res.status >= 400) {
      const err = this.buildSendError(res.status, res.data);
      this.logger.warn(
        `Graph ${action} failed (${mailboxAddress}, ${graphMessageId}): ${err.message}`,
      );
      throw err;
    }

    this.logger.log(`Graph ${action} sent from ${mailboxAddress} for message ${graphMessageId}`);
  }

  async sendMail(
    mailbox: InboundMailbox,
    to: string[],
    subject: string,
    body: string,
  ): Promise<void> {
    const config = await this.systemSettings.getM365GraphConfig();
    if (!config.active) {
      throw new BadRequestException(
        'Microsoft 365 entegrasyonu etkin değil. Ayarlar → Entegrasyonlar’dan etkinleştirin.',
      );
    }
    if (!config.tenantId?.trim() || !config.clientId?.trim() || !config.clientSecret?.trim()) {
      throw new BadRequestException(
        'Microsoft 365 kimlik bilgileri eksik. Kiracı kimliği, uygulama kimliği ve gizli anahtar gerekli.',
      );
    }

    const token = await this.graphAuth.getAccessToken({
      tenantId: config.tenantId.trim(),
      clientId: config.clientId.trim(),
      clientSecret: config.clientSecret.trim(),
    });

    const mailboxAddress = this.graphMailSync.resolveMailboxAddress(mailbox, config);
    const encodedUser = encodeURIComponent(mailboxAddress);
    const url = `${this.graphBase}/users/${encodedUser}/sendMail`;

    const trimmed = body.trim();
    const contentType = this.isHtml(trimmed) ? 'HTML' : 'Text';
    const payload = {
      message: {
        subject: subject.trim(),
        body: {
          contentType,
          content: trimmed,
        },
        toRecipients: to.map((address) => ({
          emailAddress: { address: address.trim() },
        })),
      },
      saveToSentItems: true,
    };

    const res = await firstValueFrom(
      this.http.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }),
    );

    if (res.status >= 400) {
      const err = this.buildSendError(res.status, res.data);
      this.logger.warn(`Graph sendMail failed (${mailboxAddress}): ${err.message}`);
      throw err;
    }

    this.logger.log(`Graph sendMail sent from ${mailboxAddress} to ${to.join(', ')}`);
  }

  private isHtml(text: string): boolean {
    return /<[a-z][\s\S]*>/i.test(text);
  }

  private buildSendError(status: number, data: unknown): BadRequestException {
    const graphErr = (data as { error?: { message?: string; code?: string } })?.error;
    const code = graphErr?.code?.toLowerCase() ?? '';
    const msg = graphErr?.message ?? '';
    const combined = `${code} ${msg}`.toLowerCase();

    if (
      status === 403
      || combined.includes('forbidden')
      || combined.includes('mail.send')
      || combined.includes('accessdenied')
      || combined.includes('insufficient')
    ) {
      return new BadRequestException(
        'E-posta gönderme izni yok. Azure AD uygulama kaydına Mail.Send (Uygulama) iznini ekleyin, yönetici onayını (Admin Consent) verin ve birkaç dakika bekleyin. Ayarlar → Entegrasyonlar → Microsoft 365.',
      );
    }
    if (status === 404) {
      return new BadRequestException(
        'Orijinal e-posta Microsoft 365 kutusunda bulunamadı. Kutudan silinmiş olabilir; senkronizasyonu kontrol edin.',
      );
    }
    if (status === 401) {
      return new BadRequestException(
        'Microsoft oturumu geçersiz. Gizli anahtarı Azure’dan yenileyip bağlantı testini tekrarlayın.',
      );
    }

    return new BadRequestException(msg || `E-posta gönderilemedi (HTTP ${status})`);
  }
}
