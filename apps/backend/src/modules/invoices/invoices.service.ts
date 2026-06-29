import { Injectable, Logger, NotFoundException, Optional, ForbiddenException } from '@nestjs/common';
import { canViewFileFinancials } from '@/common/helpers/financial-visibility.helper';
import { PrismaService } from '@/prisma/prisma.service';
import { FinancialSummaryService } from './financial-summary.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { LogoSyncService } from '../logo-integration/services/logo-sync.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private financialSummary: FinancialSummaryService,
    private readonly cache: CacheService,
    @Optional() private readonly logoSync?: LogoSyncService,
  ) {}

  private async generateInvoiceNo(invoiceType: string): Promise<string> {
    const prefix = invoiceType === 'purchase' ? 'ALŞ' : 'STŞ';
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await this.prisma.invoice.count({
      where: {
        invoiceType,
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${seq}`;
  }

  async findAll(params: {
    claimFileId?: string;
    invoiceType?: string;
    status?: string;
    counterpartyId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.claimFileId) where.claimFileId = params.claimFileId;
    if (params.invoiceType) where.invoiceType = params.invoiceType;
    if (params.status) where.status = params.status;
    if (params.counterpartyId) where.counterpartyId = params.counterpartyId;
    if (params.dateFrom || params.dateTo) {
      where.invoiceDate = {};
      if (params.dateFrom) where.invoiceDate.gte = new Date(params.dateFrom);
      if (params.dateTo) where.invoiceDate.lte = new Date(params.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          claimFile: { select: { id: true, fileNo: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          payments: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        payments: true,
      },
    });
    if (!invoice) throw new NotFoundException('Fatura bulunamadı');
    return invoice;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: dto.claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const invoiceNo = await this.generateInvoiceNo(dto.invoiceType);

    const invoice = await this.prisma.invoice.create({
      data: {
        claimFileId: dto.claimFileId,
        invoiceType: dto.invoiceType,
        invoiceNo,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        counterpartyType: dto.counterpartyType,
        counterpartyId: dto.counterpartyId ?? null,
        currency: dto.currency ?? 'TRY',
        subtotalAmount: dto.subtotalAmount,
        vatAmount: dto.vatAmount ?? 0,
        withholdingAmount: dto.withholdingAmount ?? 0,
        totalAmount: dto.totalAmount,
        documentFileId: dto.documentFileId ?? null,
        notes: dto.notes ?? null,
        createdByUserId: userId,
        status: 'draft',
      },
    });

    await this.financialSummary.recalculate(dto.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});

    this.triggerLogoInvoiceSync(invoice.id, invoice.invoiceType).catch(() => {});

    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.counterpartyType ? { counterpartyType: dto.counterpartyType } : {}),
        ...(dto.counterpartyId !== undefined ? { counterpartyId: dto.counterpartyId } : {}),
        ...(dto.subtotalAmount !== undefined ? { subtotalAmount: dto.subtotalAmount } : {}),
        ...(dto.vatAmount !== undefined ? { vatAmount: dto.vatAmount } : {}),
        ...(dto.withholdingAmount !== undefined ? { withholdingAmount: dto.withholdingAmount } : {}),
        ...(dto.totalAmount !== undefined ? { totalAmount: dto.totalAmount } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.documentFileId !== undefined ? { documentFileId: dto.documentFileId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.financialSummary.recalculate(invoice.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async updateStatus(id: string, status: string) {
    const invoice = await this.findOne(id);
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status } });
    await this.financialSummary.recalculate(invoice.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async remove(id: string) {
    const invoice = await this.findOne(id);
    await this.prisma.invoice.delete({ where: { id } });
    await this.financialSummary.recalculate(invoice.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
  }

  async getFinancialSummary(claimFileId: string, user?: { id: string; roleCode?: string }) {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        hideFinancialFromAssignees: true,
        financialVisibilityConfig: true,
        assignedFieldUserId: true,
        assignedOfficeUserId: true,
        currentResponsibleUserId: true,
      },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');
    if (user && !canViewFileFinancials(user, claimFile)) {
      throw new ForbiddenException('Bu dosyada finansal özet görüntüleme yetkiniz yok.');
    }

    let summary = await this.financialSummary.getByClaimFile(claimFileId);
    if (!summary) {
      await this.financialSummary.recalculate(claimFileId);
      summary = await this.financialSummary.getByClaimFile(claimFileId);
    }
    return summary;
  }

  private async triggerLogoInvoiceSync(invoiceId: string, invoiceType: string): Promise<void> {
    if (!this.logoSync) return;
    try {
      const type = invoiceType === 'purchase' ? 'purchase' : 'sales';
      await this.logoSync.queueInvoiceSync(invoiceId, type);
    } catch (err) {
      this.logger.warn(`Logo fatura senkron kuyruğu hatası: ${(err as Error).message}`);
    }
  }
}
