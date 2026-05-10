import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '@/prisma/prisma.service';
import {
  IntegrationDirection,
  IntegrationEntityType,
  IntegrationOperation,
  IntegrationStatus,
  LogoJobType,
} from '../types/integration.enums';
import { LogoJob } from '../types/logo-api.types';

export const LOGO_SYNC_QUEUE = 'logo-sync';

const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

@Injectable()
export class LogoSyncService {
  private readonly logger = new Logger(LogoSyncService.name);

  constructor(
    @InjectQueue(LOGO_SYNC_QUEUE) private readonly queue: Queue<LogoJob>,
    private readonly prisma: PrismaService,
  ) {}

  // ── Cari Hesap ────────────────────────────────────────────────────────────

  async queueArpSync(
    entityType: IntegrationEntityType.INSURANCE_COMPANY | IntegrationEntityType.VENDOR,
    entityId: string,
  ): Promise<void> {
    const log = await this.createLog(entityType, entityId, IntegrationOperation.CREATE);
    await this.queue.add(
      LogoJobType.SYNC_ARP,
      { jobType: LogoJobType.SYNC_ARP, entityType, entityId, logId: log.id },
      JOB_OPTIONS,
    );
    this.logger.log(`Cari kart kuyruğa eklendi: ${entityType}/${entityId}`);
  }

  // ── Fatura ────────────────────────────────────────────────────────────────

  async queueInvoiceSync(invoiceId: string, invoiceType: 'sales' | 'purchase'): Promise<void> {
    const jobType =
      invoiceType === 'sales' ? LogoJobType.SYNC_SALES_INVOICE : LogoJobType.SYNC_PURCHASE_INVOICE;
    const log = await this.createLog(
      IntegrationEntityType.INVOICE,
      invoiceId,
      IntegrationOperation.CREATE,
    );
    await this.queue.add(
      jobType,
      { jobType, entityType: IntegrationEntityType.INVOICE, entityId: invoiceId, logId: log.id },
      JOB_OPTIONS,
    );
    this.logger.log(`Fatura kuyruğa eklendi: ${invoiceType}/${invoiceId}`);
  }

  // ── Ödeme/Tahsilat ────────────────────────────────────────────────────────

  async queuePaymentSync(paymentId: string, paymentType: 'incoming' | 'outgoing'): Promise<void> {
    const jobType =
      paymentType === 'incoming' ? LogoJobType.SYNC_COLLECTION : LogoJobType.SYNC_PAYMENT;
    const log = await this.createLog(
      IntegrationEntityType.PAYMENT,
      paymentId,
      IntegrationOperation.CREATE,
    );
    await this.queue.add(
      jobType,
      { jobType, entityType: IntegrationEntityType.PAYMENT, entityId: paymentId, logId: log.id },
      JOB_OPTIONS,
    );
    this.logger.log(`Ödeme kuyruğa eklendi: ${paymentType}/${paymentId}`);
  }

  // ── Manuel Yeniden Gönderim ───────────────────────────────────────────────

  async retryLog(logId: string): Promise<void> {
    const log = await this.prisma.integrationLog.findUnique({ where: { id: logId } });
    if (!log) throw new Error(`Log bulunamadı: ${logId}`);

    await this.prisma.integrationLog.update({
      where: { id: logId },
      data: { status: IntegrationStatus.PENDING, retryCount: 0, errorMessage: null },
    });

    const jobTypeMap: Record<string, LogoJobType> = {
      insurance_company: LogoJobType.SYNC_ARP,
      vendor: LogoJobType.SYNC_ARP,
      invoice_sales: LogoJobType.SYNC_SALES_INVOICE,
      invoice_purchase: LogoJobType.SYNC_PURCHASE_INVOICE,
      payment_incoming: LogoJobType.SYNC_COLLECTION,
      payment_outgoing: LogoJobType.SYNC_PAYMENT,
    };

    const jobType = jobTypeMap[log.entityType] ?? LogoJobType.SYNC_ARP;

    await this.queue.add(
      jobType,
      { jobType, entityType: log.entityType, entityId: log.entityId, logId: log.id },
      JOB_OPTIONS,
    );
    this.logger.log(`Log yeniden kuyruğa eklendi: ${logId}`);
  }

  // ── Entity Mapping ────────────────────────────────────────────────────────

  async getLogoId(entityType: string, localId: string): Promise<string | null> {
    const map = await this.prisma.integrationEntityMap.findUnique({
      where: { provider_entityType_localId: { provider: 'logo_wing', entityType, localId } },
    });
    return map?.logoId ?? null;
  }

  async saveEntityMap(entityType: string, localId: string, logoId: string, logoRef?: string): Promise<void> {
    await this.prisma.integrationEntityMap.upsert({
      where: { provider_entityType_localId: { provider: 'logo_wing', entityType, localId } },
      create: { provider: 'logo_wing', entityType, localId, logoId, logoRef },
      update: { logoId, logoRef, updatedAt: new Date() },
    });
  }

  // ── Log Yardımcıları ──────────────────────────────────────────────────────

  async createLog(entityType: string, entityId: string, operation: string) {
    return this.prisma.integrationLog.create({
      data: {
        entityType,
        entityId,
        direction: IntegrationDirection.OUTBOUND,
        operation,
        status: IntegrationStatus.PENDING,
      },
    });
  }

  async updateLog(
    logId: string,
    data: {
      status: string;
      endpoint?: string;
      requestPayload?: unknown;
      responsePayload?: unknown;
      errorMessage?: string;
      logoEntityId?: string;
      retryCount?: number;
    },
  ): Promise<void> {
    await this.prisma.integrationLog.update({
      where: { id: logId },
      data: {
        status: data.status,
        endpoint: data.endpoint,
        requestPayload: data.requestPayload !== undefined ? (data.requestPayload as import('@prisma/client').Prisma.InputJsonValue) : undefined,
        responsePayload: data.responsePayload !== undefined ? (data.responsePayload as import('@prisma/client').Prisma.InputJsonValue) : undefined,
        errorMessage: data.errorMessage,
        logoEntityId: data.logoEntityId,
        retryCount: data.retryCount,
        processedAt: new Date(),
      },
    });
  }
}
