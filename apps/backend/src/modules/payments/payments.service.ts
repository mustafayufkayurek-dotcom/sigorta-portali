import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FinancialSummaryService } from '../invoices/financial-summary.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { LogoSyncService } from '../logo-integration/services/logo-sync.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CacheService } from '../../cache/cache.service';
import { StorageService } from '@/modules/storage/storage.service';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  assertClaimFileAccess,
  buildClaimFileRelationScope,
  mergeWhereAnd,
  RequestUser,
} from '@/common/helpers/claim-file-scope.helper';

/** Varsayılan vade — tedarikçi kartında seçim yoksa (geçici geri uyumluluk) */
export const VENDOR_HAKEDIS_DUE_DAYS_DEFAULT = 30;
export const VENDOR_HAKEDIS_DUE_DAYS_OPTIONS = [15, 30] as const;

export type PaymentListParams = {
  claimFileId?: string;
  payerId?: string;
  payerType?: string;
  paymentType?: string;
  status?: string;
  method?: string;
  search?: string;
  queue?: 'collection' | 'payable' | 'completed' | 'all';
  responsibleUserId?: string;
  dueBefore?: string;
  dueOverdue?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private financialSummary: FinancialSummaryService,
    private readonly cache: CacheService,
    private readonly auditLogsService: AuditLogsService,
    private readonly storage: StorageService,
    @Optional() private readonly logoSync?: LogoSyncService,
  ) {}

  private buildWhere(
    params: PaymentListParams,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};

    if (params.claimFileId) where.claimFileId = params.claimFileId;
    if (params.payerId) where.payerId = params.payerId;
    if (params.payerType) where.payerType = params.payerType;
    if (params.paymentType) where.paymentType = params.paymentType;
    if (params.status) where.status = params.status;
    if (params.method) where.method = params.method;

    if (params.queue === 'collection') {
      where.paymentType = 'incoming';
      where.status = 'pending';
    } else if (params.queue === 'payable') {
      where.paymentType = 'outgoing';
      where.status = 'pending';
    } else if (params.queue === 'completed') {
      where.status = 'completed';
    }

    if (params.dueOverdue === 'true') {
      where.paymentType = 'outgoing';
      where.status = 'pending';
      where.dueDate = { lte: new Date() };
    } else if (params.dueBefore) {
      where.dueDate = { lte: new Date(params.dueBefore) };
    }

    if (params.responsibleUserId) {
      where.claimFile = {
        OR: [
          { assignedOfficeUserId: params.responsibleUserId },
          { currentResponsibleUserId: params.responsibleUserId },
          { assignedFieldUserId: params.responsibleUserId },
        ],
      };
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { note: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { claimFile: { fileNo: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const claimScope = buildClaimFileRelationScope(requestingUser, insuranceCompanyIds);
    if (claimScope) {
      const merged = mergeWhereAnd(where as Record<string, unknown>, claimScope);
      return merged as Prisma.PaymentWhereInput;
    }

    return where;
  }

  private async computeSummary(where: Prisma.PaymentWhereInput) {
    const now = new Date();
    const [inc, out, pendIn, pendOut, dueOut, pendingLinks] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...where, paymentType: 'incoming', status: 'completed' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, paymentType: 'outgoing', status: 'completed' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, paymentType: 'incoming', status: 'pending' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...where, paymentType: 'outgoing', status: 'pending' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          paymentType: 'outgoing',
          status: 'pending',
          dueDate: { lte: now },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.paymentCollectionLink.aggregate({
        where: { status: { in: ['sent', 'opened', 'processing'] } },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      totalIncoming: inc._sum.amount ?? 0,
      totalOutgoing: out._sum.amount ?? 0,
      pendingIncoming: pendIn._sum.amount ?? 0,
      pendingIncomingCount: pendIn._count,
      pendingOutgoing: pendOut._sum.amount ?? 0,
      pendingOutgoingCount: pendOut._count,
      dueOutgoing: dueOut._sum.amount ?? 0,
      dueOutgoingCount: dueOut._count,
      pendingOnlineLinks: pendingLinks._count,
      pendingOnlineLinksAmount: pendingLinks._sum.amount ?? 0,
    };
  }

  private async enrichWithVendorNames<T extends { payerType: string; payerId: string | null }>(rows: T[]) {
    const vendorIds = [...new Set(rows.filter((r) => r.payerType === 'vendor' && r.payerId).map((r) => r.payerId!))];
    if (!vendorIds.length) return rows.map((r) => ({ ...r, vendorName: null as string | null }));

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const map = new Map(vendors.map((v) => [v.id, v.name]));
    return rows.map((r) => ({
      ...r,
      vendorName: r.payerType === 'vendor' && r.payerId ? map.get(r.payerId) ?? null : null,
    }));
  }

  async findAll(
    params: PaymentListParams,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(params, requestingUser, insuranceCompanyIds);

    const orderBy: Prisma.PaymentOrderByWithRelationInput[] =
      params.queue === 'payable' || params.dueOverdue === 'true'
        ? [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        : [{ paymentDate: 'desc' }, { createdAt: 'desc' }];

    const [rawData, total, summary] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          claimFile: {
            select: {
              id: true,
              fileNo: true,
              assignedOfficeUserId: true,
              currentResponsibleUserId: true,
              assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          invoice: { select: { id: true, invoiceNo: true } },
          bankAccount: { select: { id: true, bankName: true, iban: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          vendorStatementItem: {
            select: { id: true, lineDescription: true, statement: { select: { statementNo: true } } },
          },
        },
        orderBy,
      }),
      this.prisma.payment.count({ where }),
      this.computeSummary(where),
    ]);

    const data = await this.enrichWithVendorNames(rawData);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary,
    };
  }

  /**
   * Onaylanan tedarikçi ekstre kalemi için bekleyen giden ödeme oluşturur (idempotent).
   */
  async ensurePendingFromStatementItem(itemId: string): Promise<void> {
    const item = await this.prisma.vendorStatementItem.findUnique({
      where: { id: itemId },
      include: {
        statement: {
          select: {
            id: true,
            vendorId: true,
            statementNo: true,
            createdByUserId: true,
            vendor: { select: { paymentDueDays: true } },
          },
        },
      },
    });
    if (!item || !item.claimFileId) return;
    if (!['APPROVED', 'AUTO_APPROVED'].includes(item.approvalStatus)) return;

    const existing = await this.prisma.payment.findFirst({
      where: {
        OR: [{ vendorStatementItemId: itemId }, ...(item.paymentId ? [{ id: item.paymentId }] : [])],
      },
    });
    if (existing) return;

    const approvedAt = item.approvedAt ?? new Date();
    const vendorDays = item.statement.vendor?.paymentDueDays;
    const dueDays = VENDOR_HAKEDIS_DUE_DAYS_OPTIONS.includes(vendorDays as 15 | 30)
      ? Number(vendorDays)
      : VENDOR_HAKEDIS_DUE_DAYS_DEFAULT;
    const dueDate = new Date(approvedAt);
    dueDate.setDate(dueDate.getDate() + dueDays);

    const payment = await this.prisma.payment.create({
      data: {
        claimFileId: item.claimFileId,
        paymentType: 'outgoing',
        paymentDate: dueDate,
        dueDate,
        amount: item.totalAmount,
        currency: 'TRY',
        method: 'eft',
        payerType: 'vendor',
        payerId: item.statement.vendorId,
        status: 'pending',
        collectionChannel: 'manuel_onay',
        vendorStatementItemId: itemId,
        referenceNo: item.statement.statementNo,
        note: `Tedarikçi hakediş — ${item.statement.statementNo}: ${item.lineDescription}`,
        createdByUserId: item.statement.createdByUserId,
      },
    });

    await this.prisma.vendorStatementItem.update({
      where: { id: itemId },
      data: { paymentId: payment.id },
    });

    this.logger.log(`Hakediş kalemi ${itemId} → pending Payment ${payment.id} (vade ${dueDate.toISOString().slice(0, 10)})`);
  }

  async syncPendingPaymentsForStatement(statementId: string): Promise<void> {
    const items = await this.prisma.vendorStatementItem.findMany({
      where: {
        statementId,
        approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] },
      },
      select: { id: true },
    });
    for (const item of items) {
      await this.ensurePendingFromStatementItem(item.id).catch((err) => {
        this.logger.warn(`ensurePendingFromStatementItem(${item.id}): ${(err as Error).message}`);
      });
    }
  }

  async findOne(
    id: string,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            insuranceCompanyId: true,
            assignedFieldUserId: true,
            closedAt: true,
          },
        },
        invoice: true,
        bankAccount: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Ödeme bulunamadı');
    if (payment.claimFile) {
      assertClaimFileAccess(payment.claimFile, requestingUser, insuranceCompanyIds);
    }
    return payment;
  }

  async create(dto: CreatePaymentDto, userId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: dto.claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
      if (!invoice) throw new NotFoundException('Fatura bulunamadı');
    }

    if (dto.paymentType === 'outgoing' && dto.payerType === 'vendor' && !dto.payerId) {
      throw new BadRequestException('Tedarikçi ödemesi için tedarikçi seçilmelidir');
    }

    if (dto.payerType === 'vendor' && dto.payerId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.payerId } });
      if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı');
    }

    const payment = await this.prisma.payment.create({
      data: {
        claimFileId: dto.claimFileId,
        paymentType: dto.paymentType,
        paymentDate: new Date(dto.paymentDate),
        amount: dto.amount,
        currency: dto.currency ?? 'TRY',
        method: dto.method,
        payerType: dto.payerType,
        payerId: dto.payerId ?? null,
        invoiceId: dto.invoiceId ?? null,
        referenceNo: dto.referenceNo ?? null,
        status: dto.status ?? 'completed',
        bankAccountId: dto.bankAccountId ?? null,
        note: dto.note ?? null,
        createdByUserId: userId,
      },
    });
    this.auditLogsService.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: 'CREATE',
      newValue: payment,
      userId,
    });

    if (payment.status === 'completed') {
      this.auditLogsService.log({
        entityType: 'Payment',
        entityId: payment.id,
        action: 'APPROVE',
        newValue: { status: payment.status },
        userId,
      });
    }

    // Update linked invoice status if applicable
    if (dto.invoiceId && payment.status === 'completed') {
      await this.updateInvoicePaymentStatus(dto.invoiceId);
    }

    await this.financialSummary.recalculate(dto.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});

    // P&L Faz 3: Gelen ödeme → ClaimFileRevenue.collectedAmount güncelle
    if (payment.status === 'completed') {
      await this.syncPaymentToRevenue(payment.id, dto.claimFileId, dto.amount);
    }

    this.triggerLogoPaymentSync(payment.id, payment.paymentType).catch(() => {});

    return payment;
  }

  /** Hasar dosyasında yüklenen tedarikçi ödeme dekontu */
  async uploadReceipt(paymentId: string, file: Express.Multer.File, userId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Ödeme bulunamadı');
    if (payment.paymentType !== 'outgoing' || payment.payerType !== 'vendor') {
      throw new BadRequestException('Dekont yalnızca tedarikçi giden ödemelerine yüklenebilir');
    }

    const ext = path.extname(file.originalname) || '';
    const storageKey = this.storage.buildKey(
      'payments',
      payment.claimFileId,
      `${randomUUID()}${ext}`,
    );
    await this.storage.upload(file.buffer, storageKey, file.mimetype);

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptStorageKey: storageKey,
        receiptFileName: file.originalname,
        receiptMimeType: file.mimetype,
        receiptFileSize: file.size,
        receiptUploadedAt: new Date(),
      },
    });

    this.auditLogsService.log({
      entityType: 'Payment',
      entityId: paymentId,
      action: 'UPDATE',
      newValue: { receiptFileName: file.originalname },
      userId,
    });

    return updated;
  }

  async getReceiptDownloadUrl(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { receiptStorageKey: true, receiptFileName: true },
    });
    if (!payment?.receiptStorageKey) {
      throw new NotFoundException('Bu ödeme için dekont bulunamadı');
    }
    const url = await this.storage.getSignedUrl(payment.receiptStorageKey);
    return { url, fileName: payment.receiptFileName };
  }

  /**
   * PayTR webhook sonrası online kart tahsilatını kaydeder (idempotent — aynı link tekrar işlenmez).
   */
  async completeOnlineCardPayment(params: {
    claimFileId: string;
    amount: number;
    collectionLinkId: string;
    providerRef: string;
    userId: string;
    revenueId?: string;
    note?: string;
  }) {
    const existing = await this.prisma.payment.findUnique({
      where: { collectionLinkId: params.collectionLinkId },
    });
    if (existing) return existing;

    const payment = await this.prisma.payment.create({
      data: {
        claimFileId: params.claimFileId,
        paymentType: 'incoming',
        paymentDate: new Date(),
        amount: params.amount,
        currency: 'TRY',
        method: 'credit_card',
        payerType: 'customer',
        payerId: null,
        status: 'completed',
        collectionChannel: 'online_kart',
        collectionLinkId: params.collectionLinkId,
        providerRef: params.providerRef,
        referenceNo: params.providerRef,
        note: params.note ?? 'Online kart tahsilatı (PayTR)',
        createdByUserId: params.userId,
      },
    });

    this.auditLogsService.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: 'CREATE',
      newValue: payment,
      userId: params.userId,
    });
    this.auditLogsService.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: 'APPROVE',
      newValue: { status: payment.status, channel: 'online_kart' },
      userId: params.userId,
    });

    await this.financialSummary.recalculate(params.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});

    if (params.revenueId) {
      await this.applyPaymentToRevenue(payment.id, params.revenueId, params.amount);
    } else {
      await this.syncPaymentToRevenue(payment.id, params.claimFileId, params.amount);
    }

    this.triggerLogoPaymentSync(payment.id, payment.paymentType).catch(() => {});
    return payment;
  }

  private async applyPaymentToRevenue(paymentId: string, revenueId: string, amount: number) {
    const rev = await this.prisma.claimFileRevenue.findUnique({ where: { id: revenueId } });
    if (!rev || rev.relatedPaymentId) return;

    const needed = rev.totalAmount - rev.collectedAmount;
    const applying = Math.min(amount, needed > 0 ? needed : amount);
    const newCollected = rev.collectedAmount + applying;

    await this.prisma.claimFileRevenue.update({
      where: { id: revenueId },
      data: {
        collectedAmount: newCollected,
        collectedAt: new Date(),
        relatedPaymentId: paymentId,
        status: newCollected >= rev.totalAmount ? 'collected' : 'confirmed',
      },
    });
  }

  private async updateInvoicePaymentStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === 'cancelled') return;

    const paidAgg = await this.prisma.payment.aggregate({
      where: { invoiceId, status: 'completed' },
      _sum: { amount: true },
    });

    const totalPaid = paidAgg._sum.amount ?? 0;

    let newStatus = invoice.status;
    if (totalPaid >= invoice.totalAmount) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partial';
    }

    if (newStatus !== invoice.status) {
      await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    }
  }

  async update(id: string, dto: UpdatePaymentDto, userId?: string) {
    const payment = await this.findOne(id);
    const wasPending = payment.status === 'pending';
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.paymentDate ? { paymentDate: new Date(dto.paymentDate) } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.method ? { method: dto.method } : {}),
        ...(dto.referenceNo !== undefined ? { referenceNo: dto.referenceNo } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.bankAccountId !== undefined ? { bankAccountId: dto.bankAccountId } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.status === 'completed' && wasPending && !dto.paymentDate
          ? { paymentDate: new Date() }
          : {}),
      },
    });

    if (dto.status === 'completed' && wasPending && userId) {
      this.auditLogsService.log({
        entityType: 'Payment',
        entityId: id,
        action: 'APPROVE',
        newValue: { status: 'completed' },
        userId,
      });
    }

    if (payment.invoiceId) {
      await this.updateInvoicePaymentStatus(payment.invoiceId);
    }

    await this.financialSummary.recalculate(payment.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});

    if (dto.status === 'completed' && wasPending) {
      this.triggerLogoPaymentSync(updated.id, updated.paymentType).catch(() => {});
    }

    return updated;
  }

  private async triggerLogoPaymentSync(paymentId: string, paymentType: string): Promise<void> {
    if (!this.logoSync) return;
    try {
      const type = paymentType === 'incoming' ? 'incoming' : 'outgoing';
      await this.logoSync.queuePaymentSync(paymentId, type);
    } catch (err) {
      this.logger.warn(`Logo ödeme senkron kuyruğu hatası: ${(err as Error).message}`);
    }
  }

  /**
   * P&L Faz 3: Tamamlanan ödemeyi, o dosyadaki onaylanmamış ClaimFileRevenue kayıtlarına
   * koleksiyonuna uygular (FIFO sırası). İdempotent — relatedPaymentId kontrolü ile.
   */
  private async syncPaymentToRevenue(
    paymentId: string,
    claimFileId: string,
    amount: number,
  ): Promise<void> {
    try {
      // Henüz bu ödemeyle eşleştirilmemiş onaylı gelir kayıtları (FIFO)
      const pendingRevenues = await this.prisma.claimFileRevenue.findMany({
        where: {
          claimFileId,
          status: { in: ['confirmed', 'draft'] },
          relatedPaymentId: null,
        },
        orderBy: { entryDate: 'asc' },
      });

      let remaining = amount;
      for (const rev of pendingRevenues) {
        if (remaining <= 0) break;

        const needed = rev.totalAmount - rev.collectedAmount;
        if (needed <= 0) continue;

        const applying = Math.min(remaining, needed);
        const newCollected = rev.collectedAmount + applying;
        remaining -= applying;

        await this.prisma.claimFileRevenue.update({
          where: { id: rev.id },
          data: {
            collectedAmount: newCollected,
            collectedAt: new Date(),
            relatedPaymentId: paymentId,
            status: newCollected >= rev.totalAmount ? 'collected' : 'confirmed',
          },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`syncPaymentToRevenue hatası: ${message}`);
    }
  }

  async remove(id: string) {
    await this.prisma.payment.delete({ where: { id } });
  }
}
