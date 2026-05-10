import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@/prisma/prisma.service';
import { LogoApiClientService } from '../services/logo-api-client.service';
import { LogoMappingService } from '../services/logo-mapping.service';
import { LogoSyncService, LOGO_SYNC_QUEUE } from '../services/logo-sync.service';
import { LogoConfigService } from '../services/logo-config.service';
import {
  IntegrationEntityType,
  IntegrationStatus,
  LogoJobType,
} from '../types/integration.enums';
import { LogoJob } from '../types/logo-api.types';

@Processor(LOGO_SYNC_QUEUE)
export class LogoSyncProcessor {
  private readonly logger = new Logger(LogoSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: LogoApiClientService,
    private readonly mapping: LogoMappingService,
    private readonly syncService: LogoSyncService,
    private readonly configService: LogoConfigService,
  ) {}

  // ── Cari Hesap ────────────────────────────────────────────────────────────

  @Process(LogoJobType.SYNC_ARP)
  async handleArpSync(job: Job<LogoJob>): Promise<void> {
    const { entityType, entityId, logId } = job.data;
    this.logger.log(`Cari kart senkron: ${entityType}/${entityId}`);

    if (!(await this.configService.isEnabled())) {
      this.logger.warn('Logo entegrasyonu devre dışı, iş atlandı.');
      return;
    }

    let arpData: unknown;
    let endpoint: string;

    if (entityType === IntegrationEntityType.INSURANCE_COMPANY) {
      const company = await this.prisma.insuranceCompany.findUnique({ where: { id: entityId } });
      if (!company) throw new Error(`InsuranceCompany bulunamadı: ${entityId}`);
      arpData = await this.mapping.mapInsuranceCompanyToArp(company);
      endpoint = 'Arps';
    } else {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: entityId } });
      if (!vendor) throw new Error(`Vendor bulunamadı: ${entityId}`);
      arpData = await this.mapping.mapVendorToArp(vendor);
      endpoint = 'Arps';
    }

    await this.executeAndLog(logId!, endpoint, arpData, entityType, entityId, job.attemptsMade);
  }

  // ── Satış Faturası ────────────────────────────────────────────────────────

  @Process(LogoJobType.SYNC_SALES_INVOICE)
  async handleSalesInvoice(job: Job<LogoJob>): Promise<void> {
    const { entityId, logId } = job.data;
    this.logger.log(`Satış faturası senkron: ${entityId}`);

    if (!(await this.configService.isEnabled())) return;

    const invoice = await this.prisma.invoice.findUnique({ where: { id: entityId } });
    if (!invoice) throw new Error(`Invoice bulunamadı: ${entityId}`);

    const arpCode = await this.resolveArpCode(invoice.counterpartyType, invoice.counterpartyId);
    const data = await this.mapping.mapInvoiceToSalesInvoice(invoice, arpCode);

    await this.executeAndLog(logId!, 'salesInvoices', data, IntegrationEntityType.INVOICE, entityId, job.attemptsMade);
  }

  // ── Alış Faturası ─────────────────────────────────────────────────────────

  @Process(LogoJobType.SYNC_PURCHASE_INVOICE)
  async handlePurchaseInvoice(job: Job<LogoJob>): Promise<void> {
    const { entityId, logId } = job.data;
    this.logger.log(`Alış faturası senkron: ${entityId}`);

    if (!(await this.configService.isEnabled())) return;

    const invoice = await this.prisma.invoice.findUnique({ where: { id: entityId } });
    if (!invoice) throw new Error(`Invoice bulunamadı: ${entityId}`);

    const arpCode = await this.resolveArpCode(invoice.counterpartyType, invoice.counterpartyId);
    const data = await this.mapping.mapInvoiceToPurchaseInvoice(invoice, arpCode);

    await this.executeAndLog(logId!, 'purchaseInvoices', data, IntegrationEntityType.INVOICE, entityId, job.attemptsMade);
  }

  // ── Tahsilat ──────────────────────────────────────────────────────────────

  @Process(LogoJobType.SYNC_COLLECTION)
  async handleCollection(job: Job<LogoJob>): Promise<void> {
    const { entityId, logId } = job.data;
    this.logger.log(`Tahsilat senkron: ${entityId}`);

    if (!(await this.configService.isEnabled())) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: entityId },
      include: { invoice: true },
    });
    if (!payment) throw new Error(`Payment bulunamadı: ${entityId}`);

    const arpCode = await this.resolveArpCode(payment.payerType, payment.payerId);
    const data = await this.mapping.mapPaymentToCollectionSlip(
      payment,
      arpCode,
      payment.invoice?.invoiceNo,
    );

    await this.executeAndLog(logId!, 'collectionSlips', data, IntegrationEntityType.PAYMENT, entityId, job.attemptsMade);
  }

  // ── Tediye (Ödeme) ────────────────────────────────────────────────────────

  @Process(LogoJobType.SYNC_PAYMENT)
  async handlePayment(job: Job<LogoJob>): Promise<void> {
    const { entityId, logId } = job.data;
    this.logger.log(`Tediye senkron: ${entityId}`);

    if (!(await this.configService.isEnabled())) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: entityId },
      include: { invoice: true },
    });
    if (!payment) throw new Error(`Payment bulunamadı: ${entityId}`);

    const arpCode = await this.resolveArpCode(payment.payerType, payment.payerId);
    const data = await this.mapping.mapPaymentToPaymentSlip(
      payment,
      arpCode,
      payment.invoice?.invoiceNo,
    );

    await this.executeAndLog(logId!, 'paymentSlips', data, IntegrationEntityType.PAYMENT, entityId, job.attemptsMade);
  }

  // ── Yardımcılar ───────────────────────────────────────────────────────────

  private async resolveArpCode(counterpartyType: string, counterpartyId: string | null): Promise<string> {
    if (!counterpartyId) return 'UNKNOWN';

    const entityTypeMap: Record<string, IntegrationEntityType> = {
      insurance_company: IntegrationEntityType.INSURANCE_COMPANY,
      vendor: IntegrationEntityType.VENDOR,
    };

    const entityType = entityTypeMap[counterpartyType];
    if (entityType) {
      const logoId = await this.syncService.getLogoId(entityType, counterpartyId);
      if (logoId) return logoId;
    }

    return 'UNKNOWN';
  }

  private async executeAndLog(
    logId: string,
    endpoint: string,
    requestBody: unknown,
    entityType: string,
    entityId: string,
    attemptsMade: number,
  ): Promise<void> {
    try {
      const response = await this.apiClient.post(endpoint, requestBody);

      await this.syncService.updateLog(logId, {
        status: IntegrationStatus.SUCCESS,
        endpoint,
        requestPayload: requestBody,
        responsePayload: response,
        logoEntityId: (response as Record<string, unknown>)?.['id']?.toString() ?? undefined,
      });

      const logoId = (response as Record<string, unknown>)?.['code']?.toString()
        ?? (response as Record<string, unknown>)?.['id']?.toString()
        ?? entityId;

      await this.syncService.saveEntityMap(entityType, entityId, logoId);
    } catch (err) {
      const errorMessage = (err as Error).message || 'Bilinmeyen hata';
      const isLastAttempt = attemptsMade >= 4;

      await this.syncService.updateLog(logId, {
        status: isLastAttempt ? IntegrationStatus.DEAD : IntegrationStatus.FAILED,
        endpoint,
        requestPayload: requestBody,
        errorMessage,
        retryCount: attemptsMade + 1,
      });

      this.logger.error(`Logo senkron hatası [${endpoint}/${entityId}]: ${errorMessage}`);
      throw err;
    }
  }
}
