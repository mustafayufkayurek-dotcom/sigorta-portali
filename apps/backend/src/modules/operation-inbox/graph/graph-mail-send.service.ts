import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InboundMailbox } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { M365GraphConfig } from '../../system-settings/system-settings.service';
import { M365_GRAPH_CONFIG_KEY, SHARED_MAILBOXES } from '../operation-inbox.constants';
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
    private readonly prisma: PrismaService,
  ) {}

  private async loadGraphConfig(): Promise<M365GraphConfig> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: M365_GRAPH_CONFIG_KEY } });
    const defaults: M365GraphConfig = {
      tenantId: '',
      clientId: '',
      clientSecret: '',
      ihbarMailbox: SHARED_MAILBOXES.IHBAR,
      hasarMailbox: SHARED_MAILBOXES.HASAR,
      active: false,
    };
    return { ...defaults, ...((row?.value as Partial<M365GraphConfig> | null) ?? {}) };
  }

  async sendReply(
    mailbox: InboundMailbox,
    graphMessageId: string,
    body: string,
    replyAll = false,
  ): Promise<void> {
    const config = await this.loadGraphConfig();
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

  /** Graph sendMail gövdesi ~4MB; ek bunun altında kalmalı. */
  static readonly INLINE_ATTACH_MAX_BYTES = 2_500_000;

  async sendMail(
    mailbox: InboundMailbox,
    to: string[],
    subject: string,
    body: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    const config = await this.loadGraphConfig();
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
    if (!mailboxAddress?.trim()) {
      throw new BadRequestException(
        'Microsoft 365 kutu adresi boş. Ayarlar → Entegrasyonlar’da Hasar / İhbar kutusunu yazın.',
      );
    }
    const encodedUser = encodeURIComponent(mailboxAddress);
    const url = `${this.graphBase}/users/${encodedUser}/sendMail`;

    const trimmed = body.trim();
    const contentType = this.isHtml(trimmed) ? 'HTML' : 'Text';
    const attachBytes = (attachments ?? []).reduce((n, a) => n + (a.content?.length ?? 0), 0);
    const graphAttachments =
      attachBytes > 0 && attachBytes <= GraphMailSendService.INLINE_ATTACH_MAX_BYTES
        ? (attachments ?? []).map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentType: a.contentType || 'application/octet-stream',
            contentBytes: a.content.toString('base64'),
          }))
        : undefined;
    if (attachBytes > GraphMailSendService.INLINE_ATTACH_MAX_BYTES) {
      this.logger.warn(
        `Graph ek atlandı (${attachBytes} bayt). Mail kutu üzerinden gider; büyük PDF onay linkinden açılır.`,
      );
    }
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
        ...(graphAttachments?.length ? { attachments: graphAttachments } : {}),
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

  async isOutboundReady(): Promise<boolean> {
    const config = await this.loadGraphConfig();
    if (!config.active) return false;
    if (!config.tenantId?.trim() || !config.clientId?.trim() || !config.clientSecret?.trim()) return false;
    return Boolean(config.hasarMailbox?.trim() || config.ihbarMailbox?.trim());
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
