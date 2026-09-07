import { BadRequestException, Injectable, Logger, NotFoundException, Optional, ForbiddenException } from '@nestjs/common';
import { canViewFileFinancials } from '@/common/helpers/financial-visibility.helper';
import { PrismaService } from '@/prisma/prisma.service';
import { FinancialSummaryService } from './financial-summary.service';
import { coerceSalesInvoiceCounterparty, isInsuredCollectionParty } from '@sigorta/shared';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { appendInvoiceEditNote, staffDisplayName } from './invoice-edit-note';
import { LogoSyncService } from '../logo-integration/services/logo-sync.service';
import { CacheService } from '../../cache/cache.service';
import { sanitizeSearchQuery } from '@/common/security/sanitize-search';

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
    insuranceCompanyId?: string;
    insuranceCompanyIds?: string[];
    assistantCustomerIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    search?: string;
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
    if (params.insuranceCompanyId) {
      where.claimFile = { insuranceCompanyId: params.insuranceCompanyId };
    }
    if (params.insuranceCompanyIds?.length) {
      where.claimFile = { insuranceCompanyId: { in: params.insuranceCompanyIds } };
    }
    if (params.assistantCustomerIds?.length) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { claimFile: { customerId: { in: params.assistantCustomerIds } } },
            { emergencyCase: { customerId: { in: params.assistantCustomerIds } } },
          ],
        },
      ];
    }
    if (params.dateFrom || params.dateTo) {
      where.invoiceDate = {};
      if (params.dateFrom) where.invoiceDate.gte = new Date(params.dateFrom);
      if (params.dateTo) where.invoiceDate.lte = new Date(params.dateTo);
    }
    const search = sanitizeSearchQuery(params.search);
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { claimFile: { fileNo: { contains: search, mode: 'insensitive' } } },
            { claimFile: { insuredName: { contains: search, mode: 'insensitive' } } },
            { claimFile: { customer: { companyName: { contains: search, mode: 'insensitive' } } } },
            { claimFile: { customer: { shortName: { contains: search, mode: 'insensitive' } } } },
            { claimFile: { customer: { fullName: { contains: search, mode: 'insensitive' } } } },
            { emergencyCase: { caseNo: { contains: search, mode: 'insensitive' } } },
            { emergencyCase: { fileNo: { contains: search, mode: 'insensitive' } } },
            { emergencyCase: { customerName: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [data, total, amountAgg, paidAgg, overdueAgg, paidCount] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          claimFile: {
            select: {
              id: true,
              fileNo: true,
              insuredName: true,
              collectionParty: true,
              customer: { select: { shortName: true, companyName: true, fullName: true } },
              insuranceCompany: { select: { name: true } },
            },
          },
          emergencyCase: {
            select: {
              id: true,
              caseNo: true,
              fileNo: true,
              customerName: true,
              customerId: true,
              customer: { select: { shortName: true, companyName: true, fullName: true } },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          payments: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where: params.status ? where : { ...where, status: { not: 'cancelled' } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: 'paid' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: 'overdue' },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({ where: { ...where, status: 'paid' } }),
    ]);

    const totalAmount = amountAgg._sum.totalAmount ?? 0;
    const paidAmount = paidAgg._sum.totalAmount ?? 0;
    const overdueAmount = overdueAgg._sum.totalAmount ?? 0;

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalAmount,
        paidAmount,
        pendingAmount: Math.max(0, totalAmount - paidAmount - overdueAmount),
        overdueAmount,
        totalCount: total,
        paidCount,
      },
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        claimFile: { select: { id: true, fileNo: true, insuranceCompanyId: true, customerId: true } },
        emergencyCase: { select: { id: true, caseNo: true, fileNo: true, customerId: true, customerName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        payments: true,
      },
    });
    if (!invoice) throw new NotFoundException('Fatura bulunamadı');
    return invoice;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const claimFileId = dto.claimFileId?.trim() || null;
    const emergencyCaseId = dto.emergencyCaseId?.trim() || null;
    if (Boolean(claimFileId) === Boolean(emergencyCaseId)) {
      throw new BadRequestException('Fatura ya hasar ya acil dosyaya bağlanır');
    }

    const invoiceNo = await this.generateInvoiceNo(dto.invoiceType);

    if (emergencyCaseId) {
      const emergencyCase = await this.prisma.emergencyCase.findUnique({
        where: { id: emergencyCaseId },
        select: { id: true, customerId: true, customerName: true },
      });
      if (!emergencyCase) throw new NotFoundException('Acil dosya bulunamadı');
      const invoice = await this.prisma.invoice.create({
        data: {
          claimFileId: null,
          emergencyCaseId,
          invoiceType: dto.invoiceType,
          invoiceNo,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          counterpartyType: dto.counterpartyType,
          counterpartyId: dto.counterpartyId ?? emergencyCase.customerId ?? null,
          currency: dto.currency ?? 'TRY',
          subtotalAmount: dto.subtotalAmount,
          vatAmount: dto.vatAmount ?? 0,
          withholdingAmount: dto.withholdingAmount ?? 0,
          totalAmount: dto.totalAmount,
          documentFileId: dto.documentFileId ?? null,
          notes: dto.notes ?? emergencyCase.customerName,
          createdByUserId: userId,
          status: 'draft',
        },
      });
      await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
      if (!isInsuredCollectionParty(dto.counterpartyType)) {
        this.triggerLogoInvoiceSync(invoice.id, invoice.invoiceType).catch(() => {});
      }
      return invoice;
    }

    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId! } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const counterpartyType = coerceSalesInvoiceCounterparty({
      collectionParty: claimFile.collectionParty,
      invoiceType: dto.invoiceType,
      counterpartyType: dto.counterpartyType,
    });
    const counterpartyId = counterpartyType === 'insured' ? null : (dto.counterpartyId ?? null);
    const notes =
      dto.notes
      ?? (counterpartyType === 'insured' ? (claimFile.insuredName ?? null) : null);

    const invoice = await this.prisma.invoice.create({
      data: {
        claimFileId,
        emergencyCaseId: null,
        invoiceType: dto.invoiceType,
        invoiceNo,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        counterpartyType,
        counterpartyId,
        currency: dto.currency ?? 'TRY',
        subtotalAmount: dto.subtotalAmount,
        vatAmount: dto.vatAmount ?? 0,
        withholdingAmount: dto.withholdingAmount ?? 0,
        totalAmount: dto.totalAmount,
        documentFileId: dto.documentFileId ?? null,
        notes,
        createdByUserId: userId,
        status: 'draft',
      },
    });

    await this.touchClaimFinance(claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});

    if (!isInsuredCollectionParty(counterpartyType)) {
      this.triggerLogoInvoiceSync(invoice.id, invoice.invoiceType).catch(() => {});
    }

    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    const editReason = dto.editReason?.trim() ?? '';
    if (!editReason) {
      throw new BadRequestException('Düzenleme nedeni zorunludur.');
    }
    if (dto.invoiceNo) {
      const invoiceNo = dto.invoiceNo.trim();
      if (!invoiceNo) throw new BadRequestException('Satış fatura numarası gerekli');
      const taken = await this.prisma.invoice.findUnique({ where: { invoiceNo } });
      if (taken && taken.id !== id) {
        throw new BadRequestException('Bu fatura numarası başka bir kayıtta duruyor');
      }
    }
    const notesBase = dto.notes !== undefined ? dto.notes : invoice.notes;
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.invoiceNo ? { invoiceNo: dto.invoiceNo.trim() } : {}),
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
        notes: appendInvoiceEditNote(notesBase, editReason),
      },
    });

    await this.touchClaimFinance(invoice.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  async updateStatus(id: string, status: string) {
    const invoice = await this.findOne(id);
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status } });
    await this.touchClaimFinance(invoice.claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    return updated;
  }

  /** Talepten kesilen satış faturası — e-fatura numarası korunur, STŞ üretmez. */
  async linkOrCreateIssuedSalesInvoice(params: {
    claimFileId?: string | null;
    emergencyCaseId?: string | null;
    invoiceNo: string;
    totalAmount: number;
    insuranceCompanyId?: string | null;
    notes?: string | null;
    userId: string;
  }): Promise<{ id: string; invoiceNo: string }> {
    const invoiceNo = params.invoiceNo.trim();
    if (!invoiceNo) {
      throw new BadRequestException('Satış fatura numarası gerekli');
    }
    const claimFileId = params.claimFileId?.trim() || null;
    const emergencyCaseId = params.emergencyCaseId?.trim() || null;
    if (Boolean(claimFileId) === Boolean(emergencyCaseId)) {
      throw new BadRequestException('Fatura ya hasar ya acil dosyaya bağlanır');
    }

    const existing = await this.prisma.invoice.findUnique({ where: { invoiceNo } });
    if (existing) {
      if (claimFileId && existing.claimFileId !== claimFileId) {
        throw new BadRequestException('Bu fatura numarası başka bir dosyada kayıtlı');
      }
      if (emergencyCaseId && existing.emergencyCaseId !== emergencyCaseId) {
        throw new BadRequestException('Bu fatura numarası başka bir dosyada kayıtlı');
      }
      if (existing.invoiceType !== 'sales') {
        throw new BadRequestException('Bu fatura numarası alış faturasında kayıtlı');
      }
      return { id: existing.id, invoiceNo: existing.invoiceNo };
    }

    if (emergencyCaseId) {
      const emergencyCase = await this.prisma.emergencyCase.findUnique({
        where: { id: emergencyCaseId },
        select: { id: true, customerId: true, customerName: true },
      });
      if (!emergencyCase) throw new NotFoundException('Acil dosya bulunamadı');

      const invoice = await this.prisma.invoice.create({
        data: {
          claimFileId: null,
          emergencyCaseId,
          invoiceType: 'sales',
          invoiceNo,
          invoiceDate: new Date(),
          counterpartyType: 'customer',
          counterpartyId: emergencyCase.customerId ?? null,
          currency: 'TRY',
          subtotalAmount: params.totalAmount,
          vatAmount: 0,
          withholdingAmount: 0,
          totalAmount: params.totalAmount,
          status: 'sent',
          notes: params.notes ?? emergencyCase.customerName,
          createdByUserId: params.userId,
        },
      });
      await this.prisma.emergencyCase.update({
        where: { id: emergencyCaseId },
        data: { invoicedAt: new Date() },
      }).catch(() => {});
      await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
      this.triggerLogoInvoiceSync(invoice.id, invoice.invoiceType).catch(() => {});
      return { id: invoice.id, invoiceNo: invoice.invoiceNo };
    }

    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId! },
      select: {
        id: true,
        collectionParty: true,
        insuranceCompanyId: true,
        insuredName: true,
      },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const counterpartyType = coerceSalesInvoiceCounterparty({
      collectionParty: claimFile.collectionParty,
      invoiceType: 'sales',
      counterpartyType: 'insurance_company',
    });
    const counterpartyId = counterpartyType === 'insured'
      ? null
      : (params.insuranceCompanyId ?? claimFile.insuranceCompanyId ?? null);

    const invoice = await this.prisma.invoice.create({
      data: {
        claimFileId,
        emergencyCaseId: null,
        invoiceType: 'sales',
        invoiceNo,
        invoiceDate: new Date(),
        counterpartyType,
        counterpartyId,
        currency: 'TRY',
        subtotalAmount: params.totalAmount,
        vatAmount: 0,
        withholdingAmount: 0,
        totalAmount: params.totalAmount,
        status: 'sent',
        notes: params.notes ?? (counterpartyType === 'insured' ? (claimFile.insuredName ?? null) : null),
        createdByUserId: params.userId,
      },
    });

    await this.touchClaimFinance(claimFileId);
    await this.cache.invalidatePattern('cache:dashboard:*').catch(() => {});
    if (!isInsuredCollectionParty(counterpartyType)) {
      this.triggerLogoInvoiceSync(invoice.id, invoice.invoiceType).catch(() => {});
    }
    return { id: invoice.id, invoiceNo: invoice.invoiceNo };
  }

  async notifyFileOwner(id: string): Promise<{ notified: number; alreadyNotified: boolean; recipients: string[] }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            assignedOfficeUserId: true,
            currentResponsibleUserId: true,
          },
        },
        emergencyCase: {
          select: {
            id: true,
            caseNo: true,
            fileNo: true,
            assignedUserId: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Fatura bulunamadı');

    const ownerIds = new Set<string>();
    if (invoice.claimFile?.assignedOfficeUserId) ownerIds.add(invoice.claimFile.assignedOfficeUserId);
    if (invoice.claimFile?.currentResponsibleUserId) ownerIds.add(invoice.claimFile.currentResponsibleUserId);
    if (invoice.emergencyCase?.assignedUserId) ownerIds.add(invoice.emergencyCase.assignedUserId);
    if (ownerIds.size === 0) {
      throw new BadRequestException('Bu dosyada sorumlu personel yok. Bildirim düşmez.');
    }

    const owners = await this.prisma.user.findMany({
      where: { id: { in: [...ownerIds] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const recipients = owners.map((user) => staffDisplayName(user)).filter(Boolean);

    const fileNo = invoice.claimFile?.fileNo ?? invoice.emergencyCase?.fileNo ?? invoice.emergencyCase?.caseNo ?? '';
    const relatedEntityId = invoice.claimFileId ?? invoice.emergencyCaseId ?? invoice.id;
    const relatedEntityType = invoice.claimFileId ? 'claim_file' : invoice.emergencyCaseId ? 'emergency_case' : 'invoice';
    const body = `${fileNo} dosyasında ${invoice.invoiceNo} numaralı satış faturası kesildi.`;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    let notified = 0;
    for (const userId of ownerIds) {
      const already = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: 'sales_invoice_issued',
          relatedEntityId,
          createdAt: { gte: dayStart },
        },
        select: { id: true },
      });
      if (already) continue;
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'sales_invoice_issued',
          title: 'Kesilen fatura',
          body,
          channel: 'in_app',
          status: 'unread',
          relatedEntityType,
          relatedEntityId,
        },
      });
      notified += 1;
    }
    return { notified, alreadyNotified: notified === 0, recipients };
  }

  async remove(id: string) {
    const invoice = await this.findOne(id);
    await this.prisma.invoice.delete({ where: { id } });
    await this.touchClaimFinance(invoice.claimFileId);
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

    await this.financialSummary.recalculate(claimFileId);
    const summary = await this.financialSummary.getByClaimFile(claimFileId);
    const extraAgg = await this.prisma.expense.aggregate({
      where: { fileCaseId: claimFileId, expensePlan: 'EKSTRA_SATIS_MASRAFI' },
      _sum: { amount: true },
    });
    return {
      ...(summary ?? {}),
      extraWorkCost: extraAgg._sum.amount ?? 0,
    };
  }

  private async touchClaimFinance(claimFileId: string | null | undefined) {
    if (claimFileId) await this.financialSummary.recalculate(claimFileId);
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
