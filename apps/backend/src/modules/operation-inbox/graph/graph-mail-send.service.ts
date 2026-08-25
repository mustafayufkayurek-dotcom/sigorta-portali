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

  /** Graph JSON gövdesi ~4MB; üzeri taslak + yükleme oturumu. */
  static readonly INLINE_ATTACH_MAX_BYTES = 2_500_000;
  static readonly UPLOAD_CHUNK_BYTES = 3_276_800;

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
    const recipients = to.map((address) => address.trim()).filter(Boolean);
    if (!recipients.length) {
      throw new BadRequestException('Alıcı e-posta adresi yok.');
    }

    const encodedUser = encodeURIComponent(mailboxAddress);
    const trimmed = body.trim();
    const contentType = this.isHtml(trimmed) ? 'HTML' : 'Text';
    const files = attachments ?? [];
    const attachBytes = files.reduce((n, a) => n + (a.content?.length ?? 0), 0);
    const largeAttach = files.length > 0 && attachBytes > GraphMailSendService.INLINE_ATTACH_MAX_BYTES;
    const graphAttachments =
      files.length > 0 && !largeAttach
        ? files.map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentType: a.contentType || 'application/octet-stream',
            contentBytes: a.content.toString('base64'),
          }))
        : undefined;

    const messagePayload = {
      subject: subject.trim(),
      body: { contentType, content: trimmed },
      toRecipients: recipients.map((address) => ({
        emailAddress: { address },
      })),
      ...(graphAttachments?.length ? { attachments: graphAttachments } : {}),
    };

    // Mail.Send tek başına /sendMail ister. Taslak oluşturmak Mail.ReadWrite ister;
    // taslak 403’ü “izin yok” diye Mail.Send ekranına düşürüyordu.
    if (!largeAttach) {
      const sendMailUrl = `${this.graphBase}/users/${encodedUser}/sendMail`;
      const sendMailRes = await firstValueFrom(
        this.http.post(
          sendMailUrl,
          { message: messagePayload, saveToSentItems: true },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            validateStatus: () => true,
          },
        ),
      );
      if (sendMailRes.status >= 400) {
        this.logGraphFailure('sendMail', mailboxAddress, sendMailRes.status, sendMailRes.data);
        throw this.buildSendError(sendMailRes.status, sendMailRes.data);
      }
      this.logger.log(`Graph sendMail sent from ${mailboxAddress} to ${recipients.join(', ')}`);
      return;
    }

    const createUrl = `${this.graphBase}/users/${encodedUser}/messages`;
    const createRes = await firstValueFrom(
      this.http.post(
        createUrl,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: () => true,
        },
      ),
    );
    if (createRes.status >= 400 || !createRes.data?.id) {
      this.logGraphFailure('draft', mailboxAddress, createRes.status, createRes.data);
      throw this.buildSendError(createRes.status, createRes.data, 'draft');
    }
    const messageId = String(createRes.data.id);

    for (const file of files) {
      await this.uploadLargeAttachment(encodedUser, token, messageId, file);
    }

    const sendUrl = `${this.graphBase}/users/${encodedUser}/messages/${messageId}/send`;
    const sendRes = await firstValueFrom(
      this.http.post(sendUrl, {}, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    );
    if (sendRes.status >= 400) {
      this.logGraphFailure('send', mailboxAddress, sendRes.status, sendRes.data);
      throw this.buildSendError(sendRes.status, sendRes.data);
    }

    this.logger.log(`Graph sendMail sent from ${mailboxAddress} to ${recipients.join(', ')}`);
  }

  private async uploadLargeAttachment(
    encodedUser: string,
    token: string,
    messageId: string,
    file: { filename: string; content: Buffer; contentType?: string },
  ): Promise<void> {
    const sessionUrl = `${this.graphBase}/users/${encodedUser}/messages/${messageId}/attachments/createUploadSession`;
    const sessionRes = await firstValueFrom(
      this.http.post(
        sessionUrl,
        {
          AttachmentItem: {
            attachmentType: 'file',
            name: file.filename,
            size: file.content.length,
            contentType: file.contentType || 'application/octet-stream',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        },
      ),
    );
    const uploadUrl = sessionRes.data?.uploadUrl as string | undefined;
    if (sessionRes.status >= 400 || !uploadUrl) {
      throw this.buildSendError(sessionRes.status, sessionRes.data);
    }

    const chunk = GraphMailSendService.UPLOAD_CHUNK_BYTES;
    let offset = 0;
    while (offset < file.content.length) {
      const end = Math.min(offset + chunk, file.content.length);
      const part = file.content.subarray(offset, end);
      const putRes = await firstValueFrom(
        this.http.put(uploadUrl, part, {
          headers: {
            'Content-Length': String(part.length),
            'Content-Range': `bytes ${offset}-${end - 1}/${file.content.length}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: () => true,
        }),
      );
      if (putRes.status >= 400) {
        throw this.buildSendError(putRes.status, putRes.data);
      }
      offset = end;
    }
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

  private logGraphFailure(op: string, mailboxAddress: string, status: number, data: unknown): void {
    const graphErr = (data as { error?: { message?: string; code?: string } })?.error;
    this.logger.warn(
      `Graph ${op} failed (${mailboxAddress}) HTTP ${status} ${graphErr?.code ?? ''} ${graphErr?.message ?? ''}`.trim(),
    );
  }

  private buildSendError(status: number, data: unknown, kind: 'send' | 'draft' = 'send'): BadRequestException {
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
      if (kind === 'draft') {
        return new BadRequestException(
          'Büyük ek için kutuya taslak yazılamadı. Azure’da Mail.ReadWrite (Uygulama) ve yönetici onayı gerekir.',
        );
      }
      return new BadRequestException(
        'Microsoft Hasar kutusundan göndermeyi reddetti. Azure’da Mail.Send onayı duruyor; Exchange’te bu uygulamanın hasar kutusuna gönderim izni kapalı olabilir.',
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
