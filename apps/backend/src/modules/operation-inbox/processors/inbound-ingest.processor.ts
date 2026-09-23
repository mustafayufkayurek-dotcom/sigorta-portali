import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InboundMailbox, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { GraphAuthService } from '../graph/graph-auth.service';
import {
  GraphAttachment,
  DeltaPageResult,
  GraphMailSyncService,
  GraphMessage,
} from '../graph/graph-mail-sync.service';
import {
  buildMailReceiptDisplay,
  classifyMailReceipt,
  isLoginEmailCodeSubject,
  isReadableMailReceiptHtml,
  matchCrmEmailWatchLog,
} from '@sigorta/shared';
import { OperationInboxService } from '../operation-inbox.service';
import {
  CLASSIFY_JOB_MESSAGE,
  CLASSIFY_JOB_OPTIONS,
  INBOUND_CLASSIFY_QUEUE,
  INBOUND_INGEST_QUEUE,
  INGEST_JOB_SYNC_MAILBOX,
  INBOUND_SYNC_CUTOFF_ISO,
  isInboundBeforeSyncCutoff,
  SYNC_JOB_OPTIONS,
  SYNC_MAX_PAGES_PER_JOB,
  SyncMailboxJobData,
} from '../operation-inbox.constants';

@Processor(INBOUND_INGEST_QUEUE)
export class InboundIngestProcessor {
  private readonly logger = new Logger(InboundIngestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly systemSettings: SystemSettingsService,
    private readonly graphAuth: GraphAuthService,
    private readonly graphSync: GraphMailSyncService,
    private readonly inboxService: OperationInboxService,
    @InjectQueue(INBOUND_INGEST_QUEUE) private readonly ingestQueue: Queue<SyncMailboxJobData>,
    @InjectQueue(INBOUND_CLASSIFY_QUEUE) private readonly classifyQueue: Queue<{ messageId: string }>,
  ) {}

  @Process(INGEST_JOB_SYNC_MAILBOX)
  async handleSyncMailbox(job: Job<SyncMailboxJobData>) {
    const { mailbox, nextLink, pageCount = 0 } = job.data;
    try {
      return await this.runSyncMailbox(mailbox, nextLink, pageCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`${mailbox}: senkron başarısız — ${message}`);
      throw err;
    }
  }

  private async runSyncMailbox(
    mailbox: InboundMailbox,
    nextLink: string | undefined,
    pageCount: number,
  ) {

    const config = await this.systemSettings.getM365GraphConfig();
    if (!config.tenantId || !config.clientId || !config.clientSecret) {
      throw new Error('Microsoft 365 kimlik bilgileri eksik');
    }

    const token = await this.graphAuth.getAccessToken({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    const mailboxAddress = this.graphSync.resolveMailboxAddress(mailbox, config);

    let fetchUrl = nextLink;
    if (!fetchUrl) {
      const storedDelta = await this.graphSync.getStoredDeltaLink(mailbox);
      fetchUrl = storedDelta ?? this.graphSync.buildInitialDeltaUrl(mailboxAddress);
      if (!storedDelta) {
        this.logger.log(
          `${mailbox}: ilk delta senkron (${INBOUND_SYNC_CUTOFF_ISO} sonrası, tur başına en fazla ${SYNC_MAX_PAGES_PER_JOB} sayfa)`,
        );
      }
    }

    let page: DeltaPageResult;
    try {
      page = await this.graphSync.fetchDeltaPage(token, fetchUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!this.graphSync.isStaleDeltaError(message)) {
        throw err;
      }
      this.logger.warn(`${mailbox}: delta link geçersiz — sıfırlanıp yeniden taranıyor`);
      await this.graphSync.clearDeltaLink(mailbox);
      const restartUrl = this.graphSync.buildInitialDeltaUrl(mailboxAddress);
      this.logger.log(
        `${mailbox}: ilk delta senkron (${INBOUND_SYNC_CUTOFF_ISO} sonrası, tur başına en fazla ${SYNC_MAX_PAGES_PER_JOB} sayfa)`,
      );
      page = await this.graphSync.fetchDeltaPage(token, restartUrl);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const msg of page.messages) {
      const result = await this.ingestMessage(token, mailbox, mailboxAddress, msg);
      if (result === 'created') created += 1;
      else if (result === 'updated') updated += 1;
      else skipped += 1;
    }

    const newPageCount = pageCount + 1;

    if (page.nextLink && newPageCount < SYNC_MAX_PAGES_PER_JOB) {
      await this.ingestQueue.add(
        INGEST_JOB_SYNC_MAILBOX,
        { mailbox, nextLink: page.nextLink, pageCount: newPageCount },
        SYNC_JOB_OPTIONS,
      );
      this.logger.log(
        `${mailbox}: sayfa ${newPageCount}/${SYNC_MAX_PAGES_PER_JOB} — devam kuyruğa alındı (+${created} yeni, ${updated} güncellendi)`,
      );
      return { mailbox, created, updated, skipped, continued: true };
    }

    if (page.deltaLink) {
      await this.graphSync.saveDeltaLink(mailbox, mailboxAddress, page.deltaLink);
    } else if (page.nextLink) {
      this.logger.warn(
        `${mailbox}: sayfa limiti doldu; delta link henüz kaydedilmedi. Sonraki sync ile devam edilecek.`,
      );
      await this.ingestQueue.add(
        INGEST_JOB_SYNC_MAILBOX,
        { mailbox, nextLink: page.nextLink, pageCount: 0 },
        { ...SYNC_JOB_OPTIONS, delay: 5_000 },
      );
    }

    this.logger.log(
      `${mailbox}: senkron tamamlandı (+${created} yeni, ${updated} güncellendi, ${skipped} atlandı)`,
    );
    return { mailbox, created, updated, skipped, continued: false };
  }

  private async ingestMessage(
    token: string,
    mailbox: InboundMailbox,
    mailboxAddress: string,
    msg: GraphMessage,
  ): Promise<'created' | 'updated' | 'skipped'> {
    if (msg['@removed'] || !msg.id) return 'skipped';

    const mapped = this.mapGraphMessage(msg, mailbox);
    if (isLoginEmailCodeSubject(mapped.subject)) return 'skipped';
    const receipt = classifyMailReceipt({
      subject: mapped.subject,
      fromAddress: mapped.fromAddress,
      bodyPreview: mapped.bodyPreview,
      bodyText: mapped.bodyText,
      bodyHtml: mapped.bodyHtml,
    });
    const receivedAt =
      mapped.receivedAt instanceof Date ? mapped.receivedAt : new Date(String(mapped.receivedAt ?? ''));
    if (receipt && !isReadableMailReceiptHtml(mapped.bodyHtml)) {
      const display = buildMailReceiptDisplay({
        kind: receipt,
        originalSubject: mapped.subject,
        seenAt: receivedAt,
      });
      mapped.subject = display.subject;
      mapped.bodyPreview = display.preview;
      mapped.bodyHtml = display.html;
      mapped.bodyText = display.plain;
      await this.graphSync.rewriteMessageDisplay(token, mailboxAddress, msg.id, {
        subject: display.subject,
        html: display.html,
      });
    }
    const existing = await this.prisma.inboundMessage.findUnique({
      where: { graphMessageId: msg.id },
    });

    if (isInboundBeforeSyncCutoff(mapped.receivedAt)) {
      if (existing) {
        await this.prisma.inboundMessage.delete({ where: { id: existing.id } });
      }
      return 'skipped';
    }

    if (existing) {
      await this.prisma.inboundMessage.update({
        where: { id: existing.id },
        data: {
          subject: mapped.subject,
          bodyPreview: mapped.bodyPreview,
          bodyHtml: mapped.bodyHtml,
          bodyText: mapped.bodyText,
          fromAddress: mapped.fromAddress,
          fromName: mapped.fromName,
          toAddresses: mapped.toAddresses,
          receivedAt: mapped.receivedAt,
        },
      });
      if (msg.hasAttachments) {
        await this.syncAttachments(token, mailboxAddress, existing.id, msg.id);
      }
      return 'updated';
    }

    const created = await this.prisma.inboundMessage.create({ data: mapped });
    if (msg.hasAttachments) {
      await this.syncAttachments(token, mailboxAddress, created.id, msg.id);
    }
    if (receipt) {
      await this.inboxService.applyOutboundReceipt({
        conversationId: mapped.conversationId,
        subject: mapped.subject,
        kind: receipt,
        receivedAt,
      });
      if (receipt === 'failed') {
        await this.applyCrmMailWatch({
          kind: 'failed',
          fromAddress: mapped.fromAddress,
          subject: mapped.subject,
          receivedAt,
        });
      }
      await this.prisma.inboundMessage.update({
        where: { id: created.id },
        data: { status: 'ACTIONED', processedAt: new Date(), suggestedAction: null },
      });
      return 'created';
    }
    await this.inboxService.applyOutboundCounterpartReply({
      conversationId: mapped.conversationId,
      subject: mapped.subject,
      receivedAt,
      excludeMessageId: created.id,
    });
    await this.applyCrmMailWatch({
      kind: 'replied',
      fromAddress: mapped.fromAddress,
      subject: mapped.subject,
      receivedAt,
    });
    await this.inboxService.attemptRuleBasedLink(created.id);
    await this.classifyQueue.add(
      CLASSIFY_JOB_MESSAGE,
      { messageId: created.id },
      CLASSIFY_JOB_OPTIONS,
    );
    return 'created';
  }

  private async applyCrmMailWatch(input: {
    kind: 'failed' | 'replied';
    fromAddress?: string | null;
    subject?: string | null;
    receivedAt: Date;
  }) {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: { entityType: 'crm_relationship', action: 'crm.email.sent' },
        orderBy: { createdAt: 'desc' },
        take: 400,
      });
      const mapped = logs.map((log) => ({
        id: log.id,
        payload:
          log.newValue && typeof log.newValue === 'object' && !Array.isArray(log.newValue)
            ? (log.newValue as Record<string, unknown>)
            : {},
      }));
      const logId = matchCrmEmailWatchLog(mapped, input);
      if (!logId) return;
      const row = logs.find((item) => item.id === logId);
      if (!row) return;
      const current =
        row.newValue && typeof row.newValue === 'object' && !Array.isArray(row.newValue)
          ? (row.newValue as Record<string, unknown>)
          : {};
      const receivedAt = input.receivedAt.toISOString();
      const next =
        input.kind === 'failed'
          ? { ...current, deliveryStatus: 'bounced', bouncedAt: receivedAt }
          : { ...current, deliveryStatus: 'replied', repliedAt: receivedAt, bouncedAt: null };
      await this.prisma.auditLog.update({
        where: { id: logId },
        data: { newValue: next as Prisma.InputJsonValue },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CRM mail izi güncellenemedi: ${message}`);
    }
  }

  private mapGraphMessage(
    msg: GraphMessage,
    mailbox: InboundMailbox,
  ): Prisma.InboundMessageCreateInput {
    const bodyContent = msg.body?.content ?? '';
    const isHtml = msg.body?.contentType?.toLowerCase() === 'html';

    return {
      graphMessageId: msg.id,
      internetMessageId: msg.internetMessageId ?? null,
      conversationId: msg.conversationId ?? null,
      mailbox,
      fromAddress: msg.from?.emailAddress?.address?.trim() || 'bilinmiyor@bilinmiyor',
      fromName: msg.from?.emailAddress?.name?.trim() || null,
      toAddresses:
        msg.toRecipients
          ?.map((r) => r.emailAddress?.address?.trim())
          .filter((a): a is string => Boolean(a)) ?? [],
      subject: msg.subject?.trim() || '(Konu Yok)',
      bodyPreview: msg.bodyPreview ?? null,
      bodyHtml: isHtml ? bodyContent : null,
      bodyText: !isHtml && bodyContent ? bodyContent : null,
      receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
      status: 'NEW',
    };
  }

  private async syncAttachments(
    token: string,
    mailboxAddress: string,
    inboundMessageId: string,
    graphMessageId: string,
  ): Promise<void> {
    const attachments = await this.graphSync.listAttachments(
      token,
      mailboxAddress,
      graphMessageId,
    );

    for (const att of attachments) {
      await this.ingestAttachment(
        token,
        mailboxAddress,
        inboundMessageId,
        graphMessageId,
        att,
      );
    }
  }

  private async ingestAttachment(
    token: string,
    mailboxAddress: string,
    inboundMessageId: string,
    graphMessageId: string,
    attachment: GraphAttachment,
  ): Promise<void> {
    if (!attachment.id) return;

    const existing = await this.prisma.inboundAttachment.findFirst({
      where: { inboundMessageId, graphAttachmentId: attachment.id },
    });
    if (existing?.storageKey) return;

    const fileName = attachment.name?.trim() || 'ek';
    const contentType = attachment.contentType?.trim() || 'application/octet-stream';
    const sizeBytes = attachment.size ?? 0;

    const buffer = await this.graphSync.downloadAttachmentBytes(
      token,
      mailboxAddress,
      graphMessageId,
      attachment,
    );
    if (!buffer) return;

    const safeName = fileName.replace(/[^\w.\-() ]+/g, '_');
    const storageKey = this.storage.buildKey(
      'operation-inbox',
      inboundMessageId,
      `${attachment.id}-${safeName}`,
    );

    await this.storage.upload(buffer, storageKey, contentType);

    if (existing) {
      await this.prisma.inboundAttachment.update({
        where: { id: existing.id },
        data: {
          fileName: path.basename(safeName),
          contentType,
          sizeBytes: buffer.length || sizeBytes,
          storageKey,
        },
      });
      return;
    }

    await this.prisma.inboundAttachment.create({
      data: {
        id: randomUUID(),
        inboundMessageId,
        graphAttachmentId: attachment.id,
        fileName: path.basename(safeName),
        contentType,
        sizeBytes: buffer.length || sizeBytes,
        storageKey,
      },
    });
  }
}
