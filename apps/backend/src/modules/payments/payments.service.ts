import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FinancialSummaryService } from '../invoices/financial-summary.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { LogoSyncService } from '../logo-integration/services/logo-sync.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private financialSummary: FinancialSummaryService,
    private readonly cache: CacheService,
    private readonly auditLogsService: AuditLogsService,
    @Optional() private readonly logoSync?: LogoSyncService,
  ) {}

  async findAll(params: {
    claimFileId?: string;
    paymentType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.claimFileId) where.claimFileId = params.claimFileId;
    if (params.paymentType) where.paymentType = params.paymentType;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          claimFile: { select: { id: true, fileNo: true } },
          invoice: { select: { id: true, invoiceNo: true } },
          bankAccount: { select: { id: true, bankName: true, iban: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        invoice: true,
        bankAccount: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Ödeme bulunamadı');
    return payment;
  }

  async create(dto: CreatePaymentDto, userId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: dto.claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
      if (!invoice) throw new NotFoundException('Fatura bulunamadı');
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

  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(id);
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
      },
    });

    if (payment.invoiceId) {
      await this.updateInvoicePaymentStatus(payment.invoiceId);
    }

    await this.financialSummary.recalculate(payment.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
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
}
