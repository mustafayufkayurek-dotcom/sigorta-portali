import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InboundMailbox } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { M365GraphConfig } from '../../system-settings/system-settings.service';
import {
  DELTA_POLL_SUBSCRIPTION_PREFIX,
  GRAPH_MESSAGE_SELECT,
  SYNC_PAGE_SIZE,
  inboundSyncFilterCutoff,
} from '../operation-inbox.constants';

export interface GraphEmailAddress {
  name?: string;
  address?: string;
}

export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: GraphEmailAddress };
  toRecipients?: Array<{ emailAddress?: GraphEmailAddress }>;
  receivedDateTime?: string;
  hasAttachments?: boolean;
  '@removed'?: { reason?: string };
}

export interface GraphAttachment {
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  contentBytes?: string;
  '@odata.type'?: string;
}

export interface DeltaPageResult {
  messages: GraphMessage[];
  nextLink?: string;
  deltaLink?: string;
}

@Injectable()
export class GraphMailSyncService {
  private readonly logger = new Logger(GraphMailSyncService.name);
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  resolveMailboxAddress(mailbox: InboundMailbox, config: M365GraphConfig): string {
    return mailbox === 'IHBAR' ? config.ihbarMailbox : config.hasarMailbox;
  }

  async getStoredDeltaLink(mailbox: InboundMailbox): Promise<string | null> {
    const row = await this.prisma.graphSubscription.findFirst({
      where: {
        mailbox,
        subscriptionId: { startsWith: DELTA_POLL_SUBSCRIPTION_PREFIX },
        isActive: true,
      },
      select: { deltaLink: true },
    });
    return row?.deltaLink ?? null;
  }

  async saveDeltaLink(
    mailbox: InboundMailbox,
    mailboxAddress: string,
    deltaLink: string,
  ): Promise<void> {
    const subscriptionId = `${DELTA_POLL_SUBSCRIPTION_PREFIX}${mailbox}`;
    const resource = `/users/${mailboxAddress}/mailFolders/inbox/messages`;

    await this.prisma.graphSubscription.upsert({
      where: { subscriptionId },
      create: {
        mailbox,
        subscriptionId,
        resource,
        changeType: 'created,updated',
        clientState: 'delta-poll',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        deltaLink,
        isActive: true,
      },
      update: {
        deltaLink,
        resource,
        isActive: true,
      },
    });
  }

  buildInitialDeltaUrl(mailboxAddress: string): string {
    const encodedUser = encodeURIComponent(mailboxAddress);
    const cutoff = inboundSyncFilterCutoff();
    const filter = encodeURIComponent(`receivedDateTime ge ${cutoff.toISOString()}`);
    const select = encodeURIComponent(GRAPH_MESSAGE_SELECT);
    return (
      `${this.graphBase}/users/${encodedUser}/mailFolders/inbox/messages/delta` +
      `?$select=${select}&$top=${SYNC_PAGE_SIZE}&$filter=${filter}`
    );
  }

  async fetchDeltaPage(token: string, url: string): Promise<DeltaPageResult> {
    const res = await firstValueFrom(
      this.http.get<{
        value?: GraphMessage[];
        '@odata.nextLink'?: string;
        '@odata.deltaLink'?: string;
      }>(url, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    );

    if (res.status >= 400) {
      const graphMsg = (res.data as { error?: { message?: string } })?.error?.message;
      throw new Error(graphMsg ?? `Graph delta isteği başarısız (HTTP ${res.status})`);
    }

    return {
      messages: res.data.value ?? [],
      nextLink: res.data['@odata.nextLink'],
      deltaLink: res.data['@odata.deltaLink'],
    };
  }

  async listAttachments(
    token: string,
    mailboxAddress: string,
    graphMessageId: string,
  ): Promise<GraphAttachment[]> {
    const encodedUser = encodeURIComponent(mailboxAddress);
    const url =
      `${this.graphBase}/users/${encodedUser}/messages/${graphMessageId}/attachments` +
      '?$select=id,name,contentType,size,contentBytes';

    const res = await firstValueFrom(
      this.http.get<{ value?: GraphAttachment[] }>(url, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    );

    if (res.status >= 400) {
      this.logger.warn(
        `Ek listesi alınamadı (${graphMessageId}): HTTP ${res.status}`,
      );
      return [];
    }

    return (res.data.value ?? []).filter(
      (a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' || !a['@odata.type'],
    );
  }

  async downloadAttachmentBytes(
    token: string,
    mailboxAddress: string,
    graphMessageId: string,
    attachment: GraphAttachment,
  ): Promise<Buffer | null> {
    if (attachment.contentBytes) {
      return Buffer.from(attachment.contentBytes, 'base64');
    }

    const encodedUser = encodeURIComponent(mailboxAddress);
    const url =
      `${this.graphBase}/users/${encodedUser}/messages/${graphMessageId}` +
      `/attachments/${attachment.id}/$value`;

    try {
      const res = await firstValueFrom(
        this.http.get<ArrayBuffer>(url, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer',
        }),
      );
      return Buffer.from(res.data);
    } catch (err) {
      this.logger.warn(
        `Ek indirilemedi (${attachment.id}): ${err instanceof Error ? err.message : 'bilinmeyen hata'}`,
      );
      return null;
    }
  }
}
