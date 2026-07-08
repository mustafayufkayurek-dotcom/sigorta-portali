import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './dto/expenses.dto';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { ReceiptScanResult } from './receipt-scan.types';
import { extractReceiptFieldsFromImage } from './receipt-scan.util';
import { resolveExpenseCategoryFields } from './expense-category-resolver.util';
import { isOverheadCategoryCode } from '../finance/overhead.constants';
import {
  assertClaimFileAccess,
  buildClaimFileRelationScope,
  RequestUser,
} from '@/common/helpers/claim-file-scope.helper';

@Injectable()
export class ExpensesService {
  private minioClient: Minio.Client | null = null;
  private minioBucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.minioBucket = this.config.get<string>('MINIO_BUCKET', '') || this.config.get<string>('S3_BUCKET', 'uploads');
    try {
      const endpoint = this.config.get<string>('MINIO_ENDPOINT', '') || this.config.get<string>('S3_ENDPOINT', '');
      if (endpoint) {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `http://${endpoint}`);
        this.minioClient = new Minio.Client({
          endPoint: url.hostname,
          port: parseInt(url.port || '9000', 10),
          useSSL: url.protocol === 'https:',
          accessKey: this.config.get<string>('MINIO_ACCESS_KEY', '') || this.config.get<string>('S3_ACCESS_KEY', ''),
          secretKey: this.config.get<string>('MINIO_SECRET_KEY', '') || this.config.get<string>('S3_SECRET_KEY', ''),
        });
      }
    } catch (e) {
      // MinIO not configured
    }
  }

  private readonly claimFileExpenseSelect = {
    id: true,
    fileNo: true,
    claimNo: true,
    insuredName: true,
    description: true,
    approvedBudgetAmount: true,
    budgetVersions: {
      where: { status: 'approved' as const },
      orderBy: { versionNo: 'desc' as const },
      take: 1,
      select: { totalAmount: true },
    },
    fileRevenues: {
      where: { revenueType: 'extra_work' as const, status: { not: 'cancelled' as const } },
      select: { totalAmount: true },
    },
    customer: {
      select: {
        subType: true,
        fullName: true,
        companyName: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    },
  };

  /** Boşluk/tire vb. temizlenmiş dosya no araması */
  private buildFileSearchFilter(search: string) {
    const q = search.trim();
    if (!q) return undefined;
    const digits = q.replace(/[\s\-./]/g, '');
    const or: Array<Record<string, unknown>> = [
      { fileNo: { contains: q, mode: 'insensitive' } },
      { claimNo: { contains: q, mode: 'insensitive' } },
      { insuredName: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
    if (digits && digits !== q) {
      or.push({ fileNo: { contains: digits, mode: 'insensitive' } });
      or.push({ claimNo: { contains: digits, mode: 'insensitive' } });
    }
    if (digits.length >= 3) {
      or.push({ fileNo: { equals: digits, mode: 'insensitive' } });
    }
    return { OR: or };
  }

  /** Özel müşteri dosyalarında dosya no ile arama yapılmaz */
  private buildOzelCustomerSearchFilter(search: string) {
    const q = search.trim();
    if (!q) return undefined;
    return {
      OR: [
        { insuredName: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { customer: { fullName: { contains: q, mode: 'insensitive' as const } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' as const } } },
        { customer: { firstName: { contains: q, mode: 'insensitive' as const } } },
        { customer: { lastName: { contains: q, mode: 'insensitive' as const } } },
        { customer: { phone: { contains: q } } },
      ],
    };
  }

  private browseSegmentWhere(segment: 'hasar' | 'ozel_musteri') {
    if (segment === 'ozel_musteri') {
      return { customer: { subType: 'private_customer' } };
    }
    return {
      OR: [
        { customerId: null },
        { customer: { subType: null } },
        { customer: { subType: { not: 'private_customer' } } },
      ],
    };
  }

  private customerDisplayName(customer?: {
    subType: string | null;
    fullName: string | null;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null) {
    if (!customer) return '';
    return (
      customer.fullName
      ?? customer.companyName
      ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    );
  }

  private mapFileToEligibleOption(file: {
    id: string;
    fileNo: string;
    claimNo: string | null;
    insuredName: string | null;
    description: string | null;
    approvedBudgetAmount: number | null;
    budgetVersions: Array<{ totalAmount: number }>;
    fileRevenues: Array<{ totalAmount: number }>;
    customer?: {
      subType: string | null;
      fullName: string | null;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
    } | null;
  }) {
    const { limit, source } = this.resolveApprovedBudgetLimit(file);
    const ekBudgetLimit = file.fileRevenues.reduce(
      (s, r) => s + Number(r.totalAmount),
      0,
    );
    const customerName = this.customerDisplayName(file.customer);
    const isOzelMusteri = file.customer?.subType === 'private_customer';
    return {
      id: file.id,
      fileNo: file.fileNo,
      claimNo: file.claimNo,
      description: customerName || file.insuredName || file.description || file.claimNo || '',
      customerSubType: file.customer?.subType ?? null,
      operationSubject: isOzelMusteri ? ('OZEL_OPERASYON' as const) : ('HASAR_ONARIM' as const),
      segment: isOzelMusteri ? ('ozel_musteri' as const) : ('hasar' as const),
      hasApprovedBudget: limit > 0,
      hasEkBudget: ekBudgetLimit > 0,
      approvedBudgetLimit: limit,
      budgetSource: source,
      ekBudgetLimit,
    };
  }

  /** Onaylı bütçe: dosya alanı veya onaylı bütçe versiyonu */
  private resolveApprovedBudgetLimit(file: {
    approvedBudgetAmount: number | null;
    budgetVersions: Array<{ totalAmount: number }>;
  }): { limit: number; source: 'approved' | 'version' | 'none' } {
    if (file.approvedBudgetAmount != null && file.approvedBudgetAmount > 0) {
      return { limit: Number(file.approvedBudgetAmount), source: 'approved' };
    }
    const version = file.budgetVersions[0];
    if (version?.totalAmount != null && version.totalAmount > 0) {
      return { limit: Number(version.totalAmount), source: 'version' };
    }
    return { limit: 0, source: 'none' };
  }

  private async getEkBudgetTotal(claimFileId: string): Promise<number> {
    const agg = await this.prisma.claimFileRevenue.aggregate({
      where: {
        claimFileId,
        revenueType: 'extra_work',
        status: { not: 'cancelled' },
      },
      _sum: { totalAmount: true },
    });
    return Number(agg._sum.totalAmount ?? 0);
  }

  /** Masraf girişi yalnızca tanımlı ve onaylı bütçe / ek iş satışı olan dosyalarda */
  private async assertFileEligibleForExpense(fileCaseId: string, expensePlan?: string | null) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileCaseId },
      select: {
        fileNo: true,
        approvedBudgetAmount: true,
        budgetVersions: {
          where: { status: 'approved' },
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { totalAmount: true },
        },
      },
    });
    if (!file) throw new NotFoundException('Hasar dosyası bulunamadı');

    const plan = expensePlan ?? 'BUTCELENEN';

    if (plan === 'EKSTRA_SATIS_MASRAFI') {
      const ekBudget = await this.getEkBudgetTotal(fileCaseId);
      if (ekBudget <= 0) {
        throw new BadRequestException(
          `${file.fileNo} dosyasında ek iş satış bütçesi tanımlı değil. Masraf girişi için önce dosyada ek iş satışını kaydedin.`,
        );
      }
      return;
    }

    const { limit } = this.resolveApprovedBudgetLimit(file);
    if (limit <= 0) {
      throw new BadRequestException(
        `${file.fileNo} dosyasında onaylı bütçe yok. Masraf girişi için önce hasar dosyasında bütçe oluşturup onaylatın.`,
      );
    }
  }

  async getEligibleFiles(search?: string) {
    const searchFilter = search?.trim() ? this.buildFileSearchFilter(search) : undefined;

    const budgetOr = [
      { approvedBudgetAmount: { gt: 0 } },
      { budgetVersions: { some: { status: 'approved', totalAmount: { gt: 0 } } } },
      {
        fileRevenues: {
          some: { revenueType: 'extra_work', status: { not: 'cancelled' }, totalAmount: { gt: 0 } },
        },
      },
    ] as const;

    const rows = await this.prisma.claimFile.findMany({
      where: searchFilter
        ? { AND: [searchFilter, { OR: [...budgetOr] }] }
        : { OR: [...budgetOr] },
      select: this.claimFileExpenseSelect,
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((file) => this.mapFileToEligibleOption(file));
  }

  /** Bütçe şartı olmadan dosya arar — bulundu ama uygun değil geri bildirimi için */
  async lookupFileForExpense(query: string) {
    const q = query.trim();
    if (q.length < 2) return { found: false as const, query: q };

    const digits = q.replace(/[\s\-./]/g, '');
    const searchFilter = this.buildFileSearchFilter(q)!;

    let file =
      digits.length >= 3
        ? await this.prisma.claimFile.findFirst({
            where: { fileNo: { equals: digits, mode: 'insensitive' } },
            select: this.claimFileExpenseSelect,
          })
        : null;

    if (!file) {
      file = await this.prisma.claimFile.findFirst({
        where: searchFilter,
        select: this.claimFileExpenseSelect,
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!file) return { found: false as const, query: q };

    const mapped = this.mapFileToEligibleOption(file);
    const canEnterExpense = mapped.hasApprovedBudget || mapped.hasEkBudget;
    return {
      found: true as const,
      query: q,
      ...mapped,
      canEnterExpense,
      blockReason: canEnterExpense
        ? null
        : ('NO_BUDGET' as const),
    };
  }

  /** Masraf formu dosya seçici — bütçe filtresi olmadan listeler (çoklu dosya karışıklığını önlemek için) */
  async browseFilesForExpensePicker(params: {
    search?: string;
    page?: number;
    limit?: number;
    segment?: 'hasar' | 'ozel_musteri';
  }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(Number(params.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const segment = params.segment === 'ozel_musteri' ? 'ozel_musteri' : 'hasar';
    const searchFilter = params.search?.trim()
      ? segment === 'ozel_musteri'
        ? this.buildOzelCustomerSearchFilter(params.search)
        : this.buildFileSearchFilter(params.search)
      : undefined;

    const where = searchFilter
      ? { AND: [searchFilter, this.browseSegmentWhere(segment)] }
      : this.browseSegmentWhere(segment);

    const [total, rows] = await Promise.all([
      this.prisma.claimFile.count({ where }),
      this.prisma.claimFile.findMany({
        where,
        select: {
          ...this.claimFileExpenseSelect,
          lossType: true,
          currentStatus: { select: { name: true } },
          propertyAddress: { select: { city: true, district: true } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      data: rows.map((file) => {
        const mapped = this.mapFileToEligibleOption(file);
        return {
          ...mapped,
          lossType: file.lossType,
          statusName: file.currentStatus?.name ?? null,
          city: file.propertyAddress?.city ?? null,
          district: file.propertyAddress?.district ?? null,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      segment,
    };
  }

  async findAll(
    filters: ExpenseFilterDto,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (filters.expenseGroup) where.expenseGroup = filters.expenseGroup;
    if (filters.expensePlan) where.expensePlan = filters.expensePlan as any;
    if (filters.fileCaseId) where.fileCaseId = filters.fileCaseId;
    if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
    if (filters.operationSubject) where.operationSubject = filters.operationSubject;

    const claimScope = buildClaimFileRelationScope(requestingUser, insuranceCompanyIds);
    if (claimScope) {
      where.fileCase = claimScope.claimFile;
    }

    const [total, data] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          fileCase: { select: { id: true, fileNo: true } },
          expenseCategory: { include: { parent: true } },
        },
      }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(
    id: string,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        fileCase: {
          select: {
            id: true,
            fileNo: true,
            insuranceCompanyId: true,
            assignedFieldUserId: true,
            closedAt: true,
          },
        },
        expenseCategory: { include: { parent: true } },
      },
    });
    if (!expense) throw new NotFoundException('Masraf bulunamadı');
    if (expense.fileCase) {
      assertClaimFileAccess(expense.fileCase, requestingUser, insuranceCompanyIds);
    } else if (requestingUser && (requestingUser.roleCode === 'field_staff' || requestingUser.roleCode === 'insurance_company_user')) {
      throw new ForbiddenException('Bu masrafa erişim izniniz bulunmamaktadır');
    }
    return expense;
  }

  private async resolveGroupFields(dto: CreateExpenseDto | UpdateExpenseDto) {
    if (dto.expenseCategoryId) {
      return resolveExpenseCategoryFields(this.prisma, dto.expenseCategoryId);
    }
    if (!dto.expenseGroup || !dto.expenseSubgroup) {
      throw new BadRequestException('Masraf grubu ve alt grup seçimi zorunludur');
    }
    return {
      expenseGroup: dto.expenseGroup,
      expenseSubgroup: dto.expenseSubgroup,
      expenseCategoryId: null as string | null,
    };
  }

  async create(dto: CreateExpenseDto, userId: string) {
    if (!dto.date || dto.amount == null) {
      throw new BadRequestException('Tarih ve tutar zorunludur');
    }
    const groupFields = await this.resolveGroupFields(dto);
    const isManagementPool = groupFields.expenseGroup === 'YONETIM_GIDERLERI';

    if (isManagementPool) {
      if (dto.fileCaseId) {
        throw new BadRequestException(
          'Yönetim giderleri (kira, maaş, araç vb.) dosyaya doğrudan bağlanmaz. Havuza kaydedilir ve ay sonu onaylı bütçeli dosyalara eşit dağıtılır.',
        );
      }
      if (groupFields.expenseCategoryId) {
        const cat = await this.prisma.expenseCategory.findUnique({
          where: { id: groupFields.expenseCategoryId },
        });
        if (!cat || !isOverheadCategoryCode(cat.code)) {
          throw new BadRequestException(
            'Yönetim gideri için Sabit Gider kategorisi seçin (Ofis Kirası, Personel Maaşları, Araç Kiralama vb.).',
          );
        }
      }
    } else {
      if (!dto.fileCaseId) {
        throw new BadRequestException('Masraf girişi için hasar dosyası seçimi zorunludur.');
      }
      await this.assertFileEligibleForExpense(dto.fileCaseId, dto.expensePlan);
    }

    const date = new Date(dto.date);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekNumber = Math.ceil((dayOfYear + 1) / 7);

    const created = await this.prisma.expense.create({
      data: {
        date,
        amount: dto.amount,
        vatRate: dto.vatRate ?? 20,
        vatIncluded: dto.vatIncluded ?? true,
        description: dto.description,
        expenseGroup: groupFields.expenseGroup as any,
        expenseSubgroup: groupFields.expenseSubgroup,
        expenseCategoryId: groupFields.expenseCategoryId,
        expensePlan: isManagementPool ? null : (dto.expensePlan as any ?? null),
        operationSubject: dto.operationSubject as any ?? null,
        fileCaseId: isManagementPool ? null : (dto.fileCaseId ?? null),
        isOverheadPool: isManagementPool,
        receiptImageUrl: dto.receiptImageUrl ?? null,
        createdById: userId,
        weekNumber: dto.weekNumber ?? weekNumber,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        expenseCategory: { include: { parent: true } },
      },
    });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
      userId,
    });
    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, _userId: string) {
    const previous = await this.findOne(id);
    const groupFields = dto.expenseCategoryId
      ? await resolveExpenseCategoryFields(this.prisma, dto.expenseCategoryId)
      : {
          expenseGroup: previous.expenseGroup,
          expenseSubgroup: previous.expenseSubgroup,
          expenseCategoryId: previous.expenseCategoryId,
        };
    const isManagementPool = groupFields.expenseGroup === 'YONETIM_GIDERLERI';
    const nextFileCaseId = isManagementPool ? null : (dto.fileCaseId !== undefined ? dto.fileCaseId : previous.fileCaseId);
    const nextPlan = isManagementPool ? null : (dto.expensePlan !== undefined ? dto.expensePlan : previous.expensePlan);

    if (isManagementPool) {
      if (dto.fileCaseId) {
        throw new BadRequestException('Yönetim giderleri dosyaya bağlanamaz.');
      }
    } else {
      if (!nextFileCaseId) {
        throw new BadRequestException('Masraf kaydında hasar dosyası zorunludur.');
      }
      if (dto.fileCaseId !== undefined || dto.expensePlan !== undefined) {
        await this.assertFileEligibleForExpense(nextFileCaseId, nextPlan);
      }
    }
    const data: Record<string, unknown> = {};

    if (dto.date) data.date = new Date(dto.date);
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.vatRate !== undefined) data.vatRate = dto.vatRate;
    if (dto.vatIncluded !== undefined) data.vatIncluded = dto.vatIncluded;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.expensePlan !== undefined) data.expensePlan = isManagementPool ? null : (dto.expensePlan ?? null);
    if (dto.operationSubject !== undefined) data.operationSubject = dto.operationSubject ?? null;
    if (dto.fileCaseId !== undefined || isManagementPool) {
      data.fileCaseId = nextFileCaseId;
      data.isOverheadPool = isManagementPool;
    }
    if (dto.receiptImageUrl !== undefined) data.receiptImageUrl = dto.receiptImageUrl ?? null;
    if (dto.weekNumber !== undefined) data.weekNumber = dto.weekNumber;

    if (dto.expenseCategoryId) {
      const groupFields = await resolveExpenseCategoryFields(this.prisma, dto.expenseCategoryId);
      data.expenseGroup = groupFields.expenseGroup;
      data.expenseSubgroup = groupFields.expenseSubgroup;
      data.expenseCategoryId = groupFields.expenseCategoryId;
    } else {
      if (dto.expenseGroup) data.expenseGroup = dto.expenseGroup;
      if (dto.expenseSubgroup) data.expenseSubgroup = dto.expenseSubgroup;
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: data as any,
      include: { expenseCategory: { include: { parent: true } } },
    });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: id,
      action: 'UPDATE',
      oldValue: previous,
      newValue: updated,
      userId: _userId,
    });
    return updated;
  }

  async remove(id: string) {
    const previous = await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    this.auditLogsService.log({
      entityType: 'Expense',
      entityId: id,
      action: 'DELETE',
      oldValue: previous,
      userId: previous.createdById,
    });
    return { success: true };
  }

  async approve(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async bulkApprove(ids: string[], userId: string) {
    await this.prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    return { success: true, count: ids.length };
  }

  async getBudgetTracking(
    filters: ExpenseFilterDto,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const where: Record<string, unknown> = {};
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) (where.date as Record<string, Date>).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.date as Record<string, Date>).lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (filters.expensePlan) where.expensePlan = filters.expensePlan;
    if (filters.fileCaseId) where.fileCaseId = filters.fileCaseId;

    const claimScope = buildClaimFileRelationScope(requestingUser, insuranceCompanyIds);
    if (claimScope) {
      (where as any).fileCase = claimScope.claimFile;
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: { fileCaseId: true, amount: true, expensePlan: true },
    });

    const spentByFile = new Map<string, { butce: number; ek: number }>();
    for (const e of expenses) {
      if (!e.fileCaseId) continue;
      const cur = spentByFile.get(e.fileCaseId) ?? { butce: 0, ek: 0 };
      const amt = Number(e.amount);
      if (e.expensePlan === 'BUTCELENEN') cur.butce += amt;
      else if (e.expensePlan === 'EKSTRA_SATIS_MASRAFI') cur.ek += amt;
      spentByFile.set(e.fileCaseId, cur);
    }

    let targetFileIds = [...spentByFile.keys()];
    if (filters.fileCaseId) {
      targetFileIds = [filters.fileCaseId];
    } else if (targetFileIds.length === 0) {
      const recent = await this.prisma.claimFile.findMany({
        where: {
          OR: [
            { expenses: { some: {} } },
            { approvedBudgetAmount: { gt: 0 } },
            { budgetVersions: { some: { status: 'approved', totalAmount: { gt: 0 } } } },
          ],
        },
        select: { id: true },
        take: 80,
        orderBy: { updatedAt: 'desc' },
      });
      targetFileIds = recent.map((r) => r.id);
    }

    if (targetFileIds.length === 0) {
      return {
        summary: {
          totalBudgetLimit: 0,
          totalSpentButce: 0,
          totalSpentEk: 0,
          totalRemaining: 0,
          totalVariance: 0,
          usagePercent: null as number | null,
          overBudgetFileCount: 0,
          fileCount: 0,
        },
        files: [] as Array<Record<string, unknown>>,
      };
    }

    const claimFiles = await this.prisma.claimFile.findMany({
      where: { id: { in: targetFileIds } },
      select: {
        id: true,
        fileNo: true,
        approvedBudgetAmount: true,
        budgetVersions: {
          where: { status: 'approved' },
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { totalAmount: true, versionNo: true },
        },
      },
    });

    const extraRevenues = await this.prisma.claimFileRevenue.groupBy({
      by: ['claimFileId'],
      where: {
        claimFileId: { in: targetFileIds },
        revenueType: 'extra_work',
        status: { not: 'cancelled' },
      },
      _sum: { totalAmount: true },
    });
    const ekBudgetByFile = new Map(
      extraRevenues.map((r) => [r.claimFileId, Number(r._sum.totalAmount ?? 0)]),
    );

    const files = claimFiles.map((file) => {
      const spent = spentByFile.get(file.id) ?? { butce: 0, ek: 0 };
      const { limit: budgetLimit, source: budgetSource } = this.resolveApprovedBudgetLimit(file);

      const ekBudgetLimit = ekBudgetByFile.get(file.id) ?? 0;
      const remainingButce = budgetLimit - spent.butce;
      const varianceButce = spent.butce - budgetLimit;
      const usagePercent = budgetLimit > 0 ? Math.round((spent.butce / budgetLimit) * 100) : null;
      const remainingEk = ekBudgetLimit - spent.ek;
      const varianceEk = spent.ek - ekBudgetLimit;
      const ekUsagePercent = ekBudgetLimit > 0 ? Math.round((spent.ek / ekBudgetLimit) * 100) : null;

      let status: 'ok' | 'warning' | 'over' | 'no_budget' = 'no_budget';
      if (budgetLimit > 0) {
        if (usagePercent != null && usagePercent > 100) status = 'over';
        else if (usagePercent != null && usagePercent >= 85) status = 'warning';
        else status = 'ok';
      }

      return {
        fileCaseId: file.id,
        fileNo: file.fileNo,
        budgetLimit,
        budgetSource,
        spentButce: spent.butce,
        spentEk: spent.ek,
        remainingButce,
        varianceButce,
        usagePercent,
        ekBudgetLimit,
        remainingEk,
        varianceEk,
        ekUsagePercent,
        status,
      };
    });

    files.sort((a, b) => b.varianceButce - a.varianceButce);

    const totalBudgetLimit = files.reduce((s, f) => s + f.budgetLimit, 0);
    const totalSpentButce = files.reduce((s, f) => s + f.spentButce, 0);
    const totalSpentEk = files.reduce((s, f) => s + f.spentEk, 0);
    const totalRemaining = totalBudgetLimit - totalSpentButce;
    const totalVariance = totalSpentButce - totalBudgetLimit;
    const usagePercent = totalBudgetLimit > 0 ? Math.round((totalSpentButce / totalBudgetLimit) * 100) : null;
    const overBudgetFileCount = files.filter((f) => f.status === 'over').length;

    return {
      summary: {
        totalBudgetLimit,
        totalSpentButce,
        totalSpentEk,
        totalRemaining,
        totalVariance,
        usagePercent,
        overBudgetFileCount,
        fileCount: files.length,
      },
      files,
    };
  }

  async getSummary(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const expenses = await this.prisma.expense.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        expenseGroup: true,
        approvalStatus: true,
      },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byGroup: Record<string, number> = {};
    for (const e of expenses) {
      byGroup[e.expenseGroup] = (byGroup[e.expenseGroup] ?? 0) + Number(e.amount);
    }

    const pending = expenses.filter(e => e.approvalStatus === 'PENDING').length;
    const approved = expenses.filter(e => e.approvalStatus === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      year: y,
      month: m,
      total,
      approved,
      pending,
      byGroup,
    };
  }

  async uploadReceipt(file: Express.Multer.File): Promise<string> {
    if (!this.minioClient) {
      throw new BadRequestException('MinIO yapılandırılmamış');
    }
    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = `receipts/${uuidv4()}.${ext}`;
    await this.minioClient.putObject(
      this.minioBucket,
      key,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );
    const endpointUrl = this.config.get<string>('MINIO_PUBLIC_URL', this.config.get<string>('MINIO_ENDPOINT', ''));
    return `${endpointUrl}/${this.minioBucket}/${key}`;
  }

  async scanReceipt(file: Express.Multer.File): Promise<ReceiptScanResult> {
    const receiptImageUrl = await this.uploadReceipt(file);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const extracted = await extractReceiptFieldsFromImage(file.buffer, file.mimetype, apiKey);

    const description =
      extracted.description ||
      (extracted.merchant ? `${extracted.merchant} — fiş` : null);

    return {
      configured: extracted.configured,
      amount: extracted.amount,
      date: extracted.date,
      description,
      merchant: extracted.merchant,
      receiptImageUrl,
      message: extracted.message,
    };
  }
}
