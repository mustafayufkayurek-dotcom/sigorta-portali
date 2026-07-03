import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { InboundMailbox } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { GraphAuthService } from './graph-auth.service';
import { GraphMailSyncService } from './graph-mail-sync.service';
import { DELTA_POLL_SUBSCRIPTION_PREFIX } from '../operation-inbox.constants';
import { OperationInboxService } from '../operation-inbox.service';

const GRAPH_SUBSCRIPTIONS_URL = 'https://graph.microsoft.com/v1.0/subscriptions';
const SUBSCRIPTION_TTL_MINUTES = 4200;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GraphSubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(GraphSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
    private readonly graphAuth: GraphAuthService,
    private readonly graphSync: GraphMailSyncService,
    private readonly inboxService: OperationInboxService,
  ) {}

  async onModuleInit() {
    setTimeout(() => {
      void this.ensureSubscriptions().catch((err) => {
        this.logger.debug(
          `Başlangıç Graph abonelik kontrolü: ${err instanceof Error ? err.message : 'atlandı'}`,
        );
      });
    }, 15_000);
  }

  resolveClientState(tenantId: string, clientSecret: string): string {
    const envState = this.config.get<string>('GRAPH_WEBHOOK_CLIENT_STATE')?.trim();
    if (envState) return envState;
    return createHash('sha256')
      .update(`${tenantId}:${clientSecret}:meridyen-inbox-webhook`)
      .digest('hex')
      .slice(0, 32);
  }

  resolveNotificationUrl(): string {
    const explicit = this.config.get<string>('GRAPH_WEBHOOK_URL')?.trim();
    if (explicit) return explicit;

    const appUrl =
      this.config.get<string>('APP_URL')?.trim() ||
      this.config.get<string>('API_PUBLIC_URL')?.trim() ||
      'https://app.meridyen-tr.com';
    return `${appUrl.replace(/\/$/, '')}/api/v1/operation-inbox/webhooks/graph`;
  }

  async ensureSubscriptions(): Promise<{ ok: boolean; message: string }> {
    const config = await this.systemSettings.getM365GraphConfig();
    if (!config.active) {
      return { ok: false, message: 'Microsoft 365 entegrasyonu etkin değil' };
    }
    if (!config.tenantId || !config.clientId || !config.clientSecret) {
      return { ok: false, message: 'Microsoft 365 kimlik bilgileri eksik' };
    }

    const token = await this.graphAuth.getAccessToken({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    const clientState = this.resolveClientState(config.tenantId, config.clientSecret);
    const notificationUrl = this.resolveNotificationUrl();
    const mailboxes: InboundMailbox[] = ['IHBAR', 'HASAR'];
    const results: string[] = [];

    for (const mailbox of mailboxes) {
      const mailboxAddress = this.graphSync.resolveMailboxAddress(mailbox, config);
      const resource = `/users/${mailboxAddress}/mailFolders('Inbox')/messages`;

      const existing = await this.prisma.graphSubscription.findFirst({
        where: {
          mailbox,
          isActive: true,
          NOT: { subscriptionId: { startsWith: DELTA_POLL_SUBSCRIPTION_PREFIX } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const needsRenew =
        !existing || existing.expiresAt.getTime() - Date.now() < RENEW_BEFORE_MS;

      if (!needsRenew) {
        results.push(`${mailbox}: abonelik geçerli`);
        continue;
      }

      try {
        if (existing && !existing.subscriptionId.startsWith('webhook-notify-')) {
          await this.renewSubscription(token, existing.subscriptionId, clientState);
          await this.prisma.graphSubscription.update({
            where: { id: existing.id },
            data: {
              expiresAt: this.subscriptionExpiry(),
              clientState,
              resource,
              isActive: true,
            },
          });
          results.push(`${mailbox}: abonelik yenilendi`);
        } else {
          const created = await this.createSubscription(
            token,
            notificationUrl,
            resource,
            clientState,
          );
          if (existing) {
            await this.prisma.graphSubscription.update({
              where: { id: existing.id },
              data: {
                subscriptionId: created.id,
                resource,
                changeType: 'created',
                clientState,
                expiresAt: new Date(created.expirationDateTime),
                isActive: true,
              },
            });
          } else {
            await this.prisma.graphSubscription.create({
              data: {
                mailbox,
                subscriptionId: created.id,
                resource,
                changeType: 'created',
                clientState,
                expiresAt: new Date(created.expirationDateTime),
                isActive: true,
              },
            });
          }
          results.push(`${mailbox}: abonelik oluşturuldu`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'bilinmeyen hata';
        this.logger.warn(`${mailbox} Graph abonelik hatası: ${msg}`);
        results.push(`${mailbox}: hata (${msg})`);
      }
    }

    return { ok: true, message: results.join('; ') };
  }

  async handleNotification(payload: {
    value?: Array<{
      subscriptionId?: string;
      clientState?: string;
      resource?: string;
    }>;
  }): Promise<void> {
    const items = payload.value ?? [];
    if (items.length === 0) return;

    const config = await this.systemSettings.getM365GraphConfig();
    if (!config.active) return;

    const expectedState = this.resolveClientState(
      config.tenantId,
      config.clientSecret,
    );

    for (const item of items) {
      if (item.clientState && item.clientState !== expectedState) {
        this.logger.warn(`Graph webhook clientState uyuşmazlığı`);
      }
    }

    this.logger.log(`Graph webhook bildirimi (${items.length}) → delta sync tetiklendi`);
    await this.inboxService.triggerSync({ scheduled: true });
  }

  private subscriptionExpiry(): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() + SUBSCRIPTION_TTL_MINUTES);
    return d;
  }

  private async createSubscription(
    token: string,
    notificationUrl: string,
    resource: string,
    clientState: string,
  ): Promise<{ id: string; expirationDateTime: string }> {
    const res = await firstValueFrom(
      this.http.post<{ id: string; expirationDateTime: string }>(
        GRAPH_SUBSCRIPTIONS_URL,
        {
          changeType: 'created',
          notificationUrl,
          resource,
          expirationDateTime: this.subscriptionExpiry().toISOString(),
          clientState,
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          validateStatus: () => true,
        },
      ),
    );

    if (res.status >= 400 || !res.data.id) {
      const graphMsg = (res.data as { error?: { message?: string } })?.error?.message;
      throw new Error(graphMsg ?? `Graph abonelik oluşturulamadı (HTTP ${res.status})`);
    }
    return res.data;
  }

  private async renewSubscription(
    token: string,
    subscriptionId: string,
    clientState: string,
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch(
        `${GRAPH_SUBSCRIPTIONS_URL}/${subscriptionId}`,
        {
          expirationDateTime: this.subscriptionExpiry().toISOString(),
          clientState,
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          validateStatus: () => true,
        },
      ),
    );
    if (res.status >= 400) {
      const graphMsg = (res.data as { error?: { message?: string } })?.error?.message;
      throw new Error(graphMsg ?? `Graph abonelik yenilenemedi (HTTP ${res.status})`);
    }
  }
}
