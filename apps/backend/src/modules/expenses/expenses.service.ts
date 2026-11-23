import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
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
import { PartyAccountsService } from '../finance/party-accounts.service';
import {
  aggregateMasrafByGrup,
  normalizeMasrafAciklamaForSave,
  buildClaimFileListSearchWhere,
  canPostWorkGroupExpense,
  expenseMatchesWorkGroup,
  remainingWorkGroupBudget,
  workGroupExpenseOverLimitMessage,
  customerAllowsHasarOnarimFileExpense,
  customerMatchesExpenseLane,
  customerMatchesExpenseServiceScope,
  expenseCustomerDisplayName,
  expenseLaneFromSubject,
  EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE,
  hasExpensePartyAccountId,
  hasarFileBudgetExpenseWhere,
  isCustomerExpenseLane,
  isHariciExpenseLane,
  isYonetimOverheadPool,
  normalizeCustomerServiceScopes,
  parseExpenseLane,
  type ExpenseLane,
  parseClaimServiceKind,
} from '@sigorta/shared';
import {
  assertClaimFileAccess,
  buildClaimFileRelationScope,
  RequestUser,
} from '@/common/helpers/claim-file-scope.helper';

/** Hasar Onarım dosya masrafı: onarım ve hizmet türü boş eski onarım dosyası. Hasar Tespit / Danışmanlık müşteriye yazılır. */
const HASAR_FILE_EXPENSE_KIND_WHERE = {
  OR: [{ serviceKind: null }, { serviceKind: 'repair' }],
};

@Injectable()
export class ExpensesService {
  private minioClient: Minio.Client | null = null;
  private minioBucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    @Optional()
    @Inject(forwardRef(() => PartyAccountsService))
    private readonly partyAccounts?: PartyAccountsService,
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
    serviceKind: true,
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
        serviceScopes: true,
        fullName: true,
        companyName: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    },
  };

  /**
   * Dosya no / hasar no / sigortalı adı soyadı (kelime kelime) araması.
   * Hasar listesi ile aynı ad–soyad kapısı (`buildClaimFileListSearchWhere`).
   */
  private buildFileSearchFilter(search: string) {
    const q = search.trim();
    if (!q) return undefined;
    const base = buildClaimFileListSearchWhere(q) as { OR: Array<Record<string, unknown>> };
    const or: Array<Record<string, unknown>> = [
      ...base.OR,
      { description: { contains: q, mode: 'insensitive' } },
    ];
    const digits = q.replace(/[\s\-./]/g, '');
    if (digits && digits !== q) {
      or.push({ fileNo: { contains: digits, mode: 'insensitive' } });
      or.push({ claimNo: { contains: digits, mode: 'insensitive' } });
    }
    if (digits.length >= 3) {
      or.push({ fileNo: { equals: digits, mode: 'insensitive' } });
    }
    return { OR: or };
  }

  /** Özel müşteri dosyalarında dosya no ile arama yapılmaz; sigortalı adı soyadı kelime kelime */
  private buildOzelCustomerSearchFilter(search: string) {
    const q = search.trim();
    if (!q) return undefined;
    const tokens = q.split(/\s+/).filter(Boolean);
    const or: Array<Record<string, unknown>> = [
      { insuredName: { contains: q, mode: 'insensitive' as const } },
      { description: { contains: q, mode: 'insensitive' as const } },
      { customer: { fullName: { contains: q, mode: 'insensitive' as const } } },
      { customer: { companyName: { contains: q, mode: 'insensitive' as const } } },
      { customer: { firstName: { contains: q, mode: 'insensitive' as const } } },
      { customer: { lastName: { contains: q, mode: 'insensitive' as const } } },
      { customer: { phone: { contains: q } } },
    ];
    if (tokens.length > 1) {
      or.push({
        AND: tokens.map((token) => ({
          insuredName: { contains: token, mode: 'insensitive' as const },
        })),
      });
      or.push({
        AND: tokens.map((token) => ({
          OR: [
            { customer: { firstName: { contains: token, mode: 'insensitive' as const } } },
            { customer: { lastName: { contains: token, mode: 'insensitive' as const } } },
            { customer: { fullName: { contains: token, mode: 'insensitive' as const } } },
          ],
        })),
      });
    }
    return { OR: or };
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

  /** Hasar Onarım masraf seçicisi — yalnız Hasar Onarım / Hepsi / boş kapsam müşteri. */
  private fileCustomerAllowsHasarExpense(customer?: { serviceScopes?: unknown } | null): boolean {
    return customerAllowsHasarOnarimFileExpense(customer?.serviceScopes);
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
      serviceScopes?: unknown;
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
      // Listede önce sigortalı adı soyadı; müşteri ünvanı yedek
      description: file.insuredName || customerName || file.description || file.claimNo || '',
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

  async getWorkGroupExpenseAudit(
    fileCaseId: string,
    requestingUser?: RequestUser,
    insuranceCompanyIds?: string[],
  ) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileCaseId },
      select: {
        id: true,
        fileNo: true,
        insuranceCompanyId: true,
        assignedFieldUserId: true,
        closedAt: true,
      },
    });
    if (!file) throw new NotFoundException('Hasar dosyası bulunamadı');
    assertClaimFileAccess(file, requestingUser, insuranceCompanyIds);

    const report = await this.prisma.repairReport.findFirst({
      where: { claimFileId: fileCaseId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        reportNo: true,
        items: {
          select: {
            jobDescription: true,
            supplierTotal: true,
            workGroupId: true,
            workGroup: { select: { id: true, name: true } },
          },
        },
      },
    });

    const approved = await this.prisma.budgetVersion.findFirst({
      where: { claimFileId: fileCaseId, status: 'approved' },
      orderBy: { versionNo: 'desc' },
      include: { items: { select: { category: true, totalAmount: true } } },
    });
    const budget =
      approved
      ?? (await this.prisma.budgetVersion.findFirst({
        where: { claimFileId: fileCaseId, status: { in: ['submitted', 'draft', 'revision'] } },
        orderBy: { versionNo: 'desc' },
        include: { items: { select: { category: true, totalAmount: true } } },
      }));

    const expenses = await this.prisma.expense.findMany({
      where: {
        fileCaseId,
        expensePlan: 'BUTCELENEN',
        approvalStatus: { not: 'REJECTED' },
      },
      select: { amount: true, expenseSubgroup: true },
    });

    const byGroup = new Map<
      string,
      {
        workGroupId: string;
        workGroupName: string;
        reportSupplierTotal: number;
        budgeted: number;
        jobNames: Set<string>;
      }
    >();

    for (const item of report?.items ?? []) {
      const id = item.workGroupId;
      const name = item.workGroup?.name ?? 'İş Grubu';
      const cur = byGroup.get(id) ?? {
        workGroupId: id,
        workGroupName: name,
        reportSupplierTotal: 0,
        budgeted: 0,
        jobNames: new Set<string>(),
      };
      cur.reportSupplierTotal += Number(item.supplierTotal ?? 0);
      const job = String(item.jobDescription ?? '').trim();
      if (job) cur.jobNames.add(job);
      byGroup.set(id, cur);
    }

    for (const item of budget?.items ?? []) {
      const cat = String(item.category ?? '').trim();
      if (!cat) continue;
      const match = [...byGroup.values()].find((g) => expenseMatchesWorkGroup(cat, g.workGroupName));
      if (match) {
        match.budgeted += Number(item.totalAmount ?? 0);
        continue;
      }
      const wg = await this.prisma.workGroup.findFirst({
        where: { name: { equals: cat, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!wg) continue;
      const cur = byGroup.get(wg.id) ?? {
        workGroupId: wg.id,
        workGroupName: wg.name,
        reportSupplierTotal: 0,
        budgeted: 0,
        jobNames: new Set<string>(),
      };
      cur.budgeted += Number(item.totalAmount ?? 0);
      byGroup.set(wg.id, cur);
    }

    const subRows = byGroup.size
      ? await this.prisma.workSubGroup.findMany({
          where: {
            workGroupId: { in: [...byGroup.keys()] },
            status: 'active',
          },
          select: { workGroupId: true, name: true },
          orderBy: { sortOrder: 'asc' },
        })
      : [];

    const groups = [...byGroup.values()].map((g) => {
      const budgeted = g.budgeted > 0 ? g.budgeted : g.reportSupplierTotal;
      const spent = expenses
        .filter((e) => expenseMatchesWorkGroup(e.expenseSubgroup, g.workGroupName))
        .reduce((s, e) => s + Number(e.amount ?? 0), 0);
      const remaining = remainingWorkGroupBudget(budgeted, spent);
      const jobs = [
        ...g.jobNames,
        ...subRows.filter((s) => s.workGroupId === g.workGroupId).map((s) => s.name),
      ];
      const jobDefinitions = [...new Set(jobs.map((n) => n.trim()).filter(Boolean))];
      return {
        workGroupId: g.workGroupId,
        workGroupName: g.workGroupName,
        budgeted,
        spent,
        remaining,
        source: g.budgeted > 0 ? 'butce' : 'rapor_alis',
        jobDefinitions,
      };
    });

    return {
      fileCaseId,
      fileNo: file.fileNo,
      reportNo: report?.reportNo ?? null,
      budgetVersionNo: budget?.versionNo ?? null,
      groups,
    };
  }

  private async assertWorkGroupExpenseBudget(params: {
    fileCaseId: string;
    workGroupId: string;
    amount: number;
    excludeExpenseId?: string;
  }) {
    const audit = await this.getWorkGroupExpenseAudit(params.fileCaseId);
    const line = audit.groups.find((g) => g.workGroupId === params.workGroupId);
    if (!line) {
      throw new BadRequestException(
        'Bu iş grubu dosyanın onarım raporunda veya bütçesinde yok. Masraf işlenemez.',
      );
    }
    let spent = line.spent;
    if (params.excludeExpenseId) {
      const prev = await this.prisma.expense.findUnique({
        where: { id: params.excludeExpenseId },
        select: { amount: true },
      });
      spent = remainingWorkGroupBudget(spent, Number(prev?.amount ?? 0));
    }
    if (!canPostWorkGroupExpense({ budgeted: line.budgeted, spent, incoming: params.amount })) {
      throw new BadRequestException(
        workGroupExpenseOverLimitMessage(line.workGroupName, remainingWorkGroupBudget(line.budgeted, spent)),
      );
    }
  }

  /** Masraf girişi yalnızca tanımlı ve onaylı bütçe / ek iş satışı olan dosyalarda */
  private async assertFileEligibleForExpense(fileCaseId: string, expensePlan?: string | null) {
    const file = await this.prisma.claimFile.findUnique({
      where: { id: fileCaseId },
      select: {
        fileNo: true,
        serviceKind: true,
        approvedBudgetAmount: true,
        budgetVersions: {
          where: { status: 'approved' },
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { totalAmount: true },
        },
        customer: { select: { serviceScopes: true } },
      },
    });
    if (!file) throw new NotFoundException('Hasar dosyası bulunamadı');
    const kind = parseClaimServiceKind(file.serviceKind);
    if (kind === 'consultancy') {
      throw new BadRequestException(
        'Bu dosya Hasar onarım değildir. Danışmanlık ve asistans masrafı müşteriye yazılır.',
      );
    }
    if (kind === 'inspection') {
      throw new BadRequestException(
        'Bu dosya Hasar Tespit’tir. Hasar Tespit masrafı müşteriye yazılır.',
      );
    }
    if (!this.fileCustomerAllowsHasarExpense(file.customer)) {
      throw new BadRequestException(
        `${file.fileNo} dosyasının müşterisi Hasar Onarım kapsamında değil. Danışmanlık / Hasar Tespit masrafı müşteriye yazılır.`,
      );
    }

    const plan = expensePlan ?? 'BUTCELENEN';

    if (plan === 'EKSTRA_SATIS_MASRAFI') {
      const ekBudget = await this.getEkBudgetTotal(fileCaseId);
      if (ekBudget <= 0) {
        throw new BadRequestException(
          `${file.fileNo} dosyasında ek iş satış bütçesi tanımlı değil. Masraf girişi için önce dosyada ek iş satışını kaydedin.`,
        );
      }
      return kind;
    }

    const { limit } = this.resolveApprovedBudgetLimit(file);
    if (limit <= 0) {
      const [submitted, reportSum] = await Promise.all([
        this.prisma.budgetVersion.findFirst({
          where: {
            claimFileId: fileCaseId,
            status: { in: ['submitted', 'approved'] },
            totalAmount: { gt: 0 },
          },
          select: { id: true },
        }),
        this.prisma.repairReportItem.aggregate({
          where: { report: { claimFileId: fileCaseId } },
          _sum: { supplierTotal: true },
        }),
      ]);
      if (!submitted && !(Number(reportSum._sum.supplierTotal ?? 0) > 0)) {
        throw new BadRequestException(
          `${file.fileNo} dosyasında onaylı bütçe veya rapor iş grubu yok. Masraf girişi için önce onarım raporuna iş grubu ekleyin.`,
        );
      }
    }
    return kind;
  }

  async getEligibleFiles(search?: string, _laneRaw?: string) {
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
        ? { AND: [HASAR_FILE_EXPENSE_KIND_WHERE, searchFilter, { OR: [...budgetOr] }] }
        : { AND: [HASAR_FILE_EXPENSE_KIND_WHERE, { OR: [...budgetOr] }] },
      select: this.claimFileExpenseSelect,
      take: 120,
      orderBy: { updatedAt: 'desc' },
    });

    return rows
      .filter((file) => this.fileCustomerAllowsHasarExpense(file.customer))
      .slice(0, 50)
      .map((file) => this.mapFileToEligibleOption(file));
  }

  /** Bütçe şartı olmadan dosya arar — bulundu ama uygun değil geri bildirimi için */
  async lookupFileForExpense(query: string, _laneRaw?: string) {
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
    const kind = parseClaimServiceKind(file.serviceKind);
    if (kind === 'inspection' || kind === 'consultancy') {
      return {
        found: true as const,
        query: q,
        ...mapped,
        canEnterExpense: false,
        blockReason: 'CUSTOMER_LANE' as const,
      };
    }
    if (!this.fileCustomerAllowsHasarExpense(file.customer)) {
      return {
        found: true as const,
        query: q,
        ...mapped,
        canEnterExpense: false,
        blockReason: 'CUSTOMER_LANE' as const,
      };
    }
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

    const where = {
      AND: [
        HASAR_FILE_EXPENSE_KIND_WHERE,
        this.browseSegmentWhere(segment),
        ...(searchFilter ? [searchFilter] : []),
      ],
    };

    // Müşteri hizmet kapsamı bellek içinde süzülür (JSON dizi kapısı).
    const pool = await this.prisma.claimFile.findMany({
      where,
      select: {
        ...this.claimFileExpenseSelect,
        lossType: true,
        currentStatus: { select: { name: true } },
        propertyAddress: { select: { city: true, district: true } },
      },
      take: Math.min(500, Math.max(limit * 8, skip + limit * 4)),
      orderBy: { updatedAt: 'desc' },
    });
    const filtered = pool.filter((file) => this.fileCustomerAllowsHasarExpense(file.customer));
    const total = filtered.length;
    const rows = filtered.slice(skip, skip + limit);

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
    if (filters.expenseCategoryParentId) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { expenseCategoryId: filters.expenseCategoryParentId },
            { expenseCategory: { parentId: filters.expenseCategoryParentId } },
          ],
        },
      ];
    }
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
          customer: {
            select: {
              id: true,
              subType: true,
              fullName: true,
              companyName: true,
              shortName: true,
              firstName: true,
              lastName: true,
            },
          },
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

  private async assertCustomerExpense(customerId: string | null | undefined, lane: ExpenseLane) {
    if (!customerId) {
      throw new BadRequestException('Müşteri seçimi zorunludur.');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, subType: true, status: true },
    });
    if (!customer || customer.status === 'blacklisted') {
      throw new BadRequestException('Müşteri bulunamadı.');
    }
    if (!customerMatchesExpenseLane(customer.subType, lane)) {
      throw new BadRequestException(
        lane === 'asistans'
          ? 'Acil Yardım masrafı asistans firmasına yazılır.'
          : 'Hasar Tespit, Danışmanlık ve Poliçe Yönetimi masrafı asistans firmasına yazılmaz.',
      );
    }
  }

  async listCustomersForExpense(laneRaw: string | undefined, search?: string) {
    const lane = parseExpenseLane(laneRaw);
    if (!lane || !isCustomerExpenseLane(lane)) {
      throw new BadRequestException(
        'Müşteri listesi Hasar Tespit, Danışmanlık, Poliçe Yönetimi veya Acil Yardım içindir.',
      );
    }
    const q = search?.trim();
    const nameOr = q
      ? [
          { fullName: { contains: q, mode: 'insensitive' as const } },
          { companyName: { contains: q, mode: 'insensitive' as const } },
          { shortName: { contains: q, mode: 'insensitive' as const } },
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
        ]
      : undefined;
    const asistansSub = { subType: { in: ['asistan_firmasi', 'asistans_firmasi'] } };
    const rows = await this.prisma.customer.findMany({
      where: {
        status: { not: 'blacklisted' },
        ...(lane === 'asistans' ? asistansSub : { NOT: asistansSub }),
        ...(nameOr ? { OR: nameOr } : {}),
      },
      select: {
        id: true,
        subType: true,
        serviceScopes: true,
        fullName: true,
        companyName: true,
        shortName: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 80,
    });
    return rows
      .filter((row) => customerMatchesExpenseLane(row.subType, lane))
      .filter((row) => customerMatchesExpenseServiceScope(row.serviceScopes, lane))
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        subType: row.subType,
        serviceScopes: normalizeCustomerServiceScopes(row.serviceScopes),
        // Masraf tarafı — kısa ad yok; ünvan / ad soyad.
        name: expenseCustomerDisplayName(row),
      }));
  }

  async create(
    dto: CreateExpenseDto,
    userId: string,
    opts?: { requirePartyAccount?: boolean },
  ) {
    if (!dto.date || dto.amount == null) {
      throw new BadRequestException('Tarih ve tutar zorunludur');
    }
    const requirePartyAccount = opts?.requirePartyAccount !== false;
    if (requirePartyAccount && !hasExpensePartyAccountId(dto.partyAccountId)) {
      throw new BadRequestException(EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE);
    }
    if (dto.workGroupId && dto.fileCaseId) {
      const wg = await this.prisma.workGroup.findUnique({
        where: { id: dto.workGroupId },
        select: { id: true, name: true },
      });
      if (!wg) throw new BadRequestException('İş grubu bulunamadı');
      dto.expenseGroup = 'ONARIM_GIDERLERI';
      dto.expenseSubgroup = dto.workSubGroupName?.trim()
        ? `${wg.name} · ${dto.workSubGroupName.trim()}`
        : wg.name;
      dto.expenseCategoryId = undefined;
    }
    const groupFields = await this.resolveGroupFields(dto);
    const createLane = expenseLaneFromSubject(dto.operationSubject);
    const customerLane = isCustomerExpenseLane(createLane);
    const hariciLane = isHariciExpenseLane(createLane);
    const isOverheadPool = isYonetimOverheadPool({
      expenseGroup: groupFields.expenseGroup,
      customerId: customerLane ? dto.customerId : null,
      fileCaseId: !customerLane && !hariciLane ? dto.fileCaseId : null,
    });

    if (isOverheadPool) {
      if (groupFields.expenseCategoryId) {
        const cat = await this.prisma.expenseCategory.findUnique({
          where: { id: groupFields.expenseCategoryId },
        });
        if (!cat || !isOverheadCategoryCode(cat.code)) {
          throw new BadRequestException(
            'Havuza yazılan yönetim gideri için Sabit Gider kategorisi seçin (Ofis Kirası, Personel Maaşları, Araç Kiralama vb.).',
          );
        }
      }
    } else if (hariciLane) {
      if (dto.fileCaseId || dto.customerId) {
        throw new BadRequestException('Harici masraf dosyaya veya müşteriye yazılmaz.');
      }
    } else if (customerLane) {
      if (dto.fileCaseId) {
        throw new BadRequestException(
          'Hasar Tespit, Danışmanlık, Poliçe Yönetimi ve Acil Yardım masrafı dosyaya yazılmaz. Müşteri seçin.',
        );
      }
      await this.assertCustomerExpense(dto.customerId, createLane);
    } else {
      if (!dto.fileCaseId) {
        throw new BadRequestException('Masraf girişi için hasar dosyası seçimi zorunludur.');
      }
      await this.assertFileEligibleForExpense(dto.fileCaseId, dto.expensePlan);
      const plan = dto.expensePlan ?? 'BUTCELENEN';
      // İş grubu seçimi zorunlu değil; seçilmişse o satırın bütçesi denetlenir.
      if (plan === 'BUTCELENEN' && dto.workGroupId) {
        const audit = await this.getWorkGroupExpenseAudit(dto.fileCaseId);
        const line = audit.groups.find((g) => g.workGroupId === dto.workGroupId);
        if (line && line.jobDefinitions.length > 0 && !String(dto.workSubGroupName ?? '').trim()) {
          throw new BadRequestException('İş tanımı seçimi zorunludur.');
        }
        await this.assertWorkGroupExpenseBudget({
          fileCaseId: dto.fileCaseId,
          workGroupId: dto.workGroupId,
          amount: dto.amount,
        });
      }
    }
    const date = new Date(dto.date);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekNumber = Math.ceil((dayOfYear + 1) / 7);

    const partyAccountId = hasExpensePartyAccountId(dto.partyAccountId)
      ? dto.partyAccountId.trim()
      : null;
    if (partyAccountId) {
      const account = await this.prisma.partyAccount.findFirst({
        where: { id: partyAccountId, isActive: true },
        select: { id: true },
      });
      if (!account) throw new BadRequestException('Seçilen cari hesap bulunamadı.');
    }

    const created = await this.prisma.expense.create({
      data: {
        date,
        amount: dto.amount,
        vatRate: dto.vatRate ?? 20,
        vatIncluded: dto.vatIncluded ?? true,
        hasTaxDocument: dto.hasTaxDocument !== false,
        receiptDocumentType: dto.receiptDocumentType?.trim() || null,
        receiptDocumentNo: dto.receiptDocumentNo?.trim() || null,
        description: normalizeMasrafAciklamaForSave(dto.description ?? '') || dto.description,
        expenseGroup: groupFields.expenseGroup as any,
        expenseSubgroup: groupFields.expenseSubgroup,
        expenseCategoryId: groupFields.expenseCategoryId,
        expensePlan: isOverheadPool || customerLane || hariciLane ? null : (dto.expensePlan as any ?? null),
        operationSubject: dto.operationSubject as any ?? null,
        fileCaseId: isOverheadPool || customerLane || hariciLane ? null : (dto.fileCaseId ?? null),
        customerId: customerLane ? (dto.customerId ?? null) : null,
        partyAccountId,
        isOverheadPool,
        receiptImageUrl: dto.receiptImageUrl ?? null,
        createdById: userId,
        weekNumber: dto.weekNumber ?? weekNumber,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        expenseCategory: { include: { parent: true } },
      },
    });

    if (partyAccountId && this.partyAccounts) {
      await this.partyAccounts.syncExpenseDebit({
        accountId: partyAccountId,
        expenseId: created.id,
        amount: Number(dto.amount),
        entryDate: date,
        description: dto.description?.trim() || 'Masraf',
        userId,
      });
    }
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
    const lane = expenseLaneFromSubject(dto.operationSubject ?? previous.operationSubject);
    const customerLane = isCustomerExpenseLane(lane);
    const hariciLane = isHariciExpenseLane(lane);
    const nextCustomerId = customerLane
      ? (dto.customerId !== undefined ? dto.customerId : previous.customerId)
      : null;
    const nextFileCaseIdCandidate = customerLane || hariciLane
      ? null
      : (dto.fileCaseId !== undefined ? dto.fileCaseId : previous.fileCaseId);
    const isOverheadPool = isYonetimOverheadPool({
      expenseGroup: groupFields.expenseGroup,
      customerId: nextCustomerId,
      fileCaseId: nextFileCaseIdCandidate,
    });
    const nextFileCaseId = isOverheadPool || customerLane || hariciLane
      ? null
      : nextFileCaseIdCandidate;
    const nextPlan = isOverheadPool || customerLane || hariciLane
      ? null
      : (dto.expensePlan !== undefined ? dto.expensePlan : previous.expensePlan);

    if (isOverheadPool) {
      // Müşteri/dosya yok — havuz; ay sonu dağıtım.
    } else if (hariciLane) {
      if (dto.fileCaseId || dto.customerId) {
        throw new BadRequestException('Harici masraf dosyaya veya müşteriye yazılmaz.');
      }
    } else if (customerLane) {
      if (dto.fileCaseId) {
        throw new BadRequestException(
          'Hasar Tespit, Danışmanlık, Poliçe Yönetimi ve Acil Yardım masrafı dosyaya yazılmaz. Müşteri seçin.',
        );
      }
      await this.assertCustomerExpense(nextCustomerId, lane);
    } else {
      if (!nextFileCaseId) {
        throw new BadRequestException('Masraf kaydında hasar dosyası zorunludur.');
      }
      if (dto.fileCaseId !== undefined || dto.expensePlan !== undefined || dto.operationSubject !== undefined) {
        await this.assertFileEligibleForExpense(nextFileCaseId, nextPlan);
      }
    }
    const data: Record<string, unknown> = {};

    if (dto.date) data.date = new Date(dto.date);
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.vatRate !== undefined) data.vatRate = dto.vatRate;
    if (dto.vatIncluded !== undefined) data.vatIncluded = dto.vatIncluded;
    if (dto.hasTaxDocument !== undefined) data.hasTaxDocument = dto.hasTaxDocument;
    if (dto.receiptDocumentType !== undefined) {
      data.receiptDocumentType = dto.receiptDocumentType?.trim() || null;
    }
    if (dto.receiptDocumentNo !== undefined) {
      data.receiptDocumentNo = dto.receiptDocumentNo?.trim() || null;
    }
    if (dto.description !== undefined) {
      data.description = normalizeMasrafAciklamaForSave(dto.description) || dto.description;
    }
    if (dto.expensePlan !== undefined || customerLane || hariciLane || isOverheadPool) {
      data.expensePlan = nextPlan;
    }
    if (dto.operationSubject !== undefined) data.operationSubject = dto.operationSubject ?? null;
    if (dto.fileCaseId !== undefined || dto.operationSubject !== undefined || dto.customerId !== undefined || isOverheadPool || hariciLane) {
      data.fileCaseId = nextFileCaseId;
      data.customerId = nextCustomerId;
      data.isOverheadPool = isOverheadPool;
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

    const previousPartyId = hasExpensePartyAccountId(previous.partyAccountId)
      ? String(previous.partyAccountId).trim()
      : null;
    let nextPartyId = previousPartyId;
    if (dto.partyAccountId !== undefined) {
      if (!hasExpensePartyAccountId(dto.partyAccountId)) {
        throw new BadRequestException(EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE);
      }
      nextPartyId = dto.partyAccountId.trim();
      const account = await this.prisma.partyAccount.findFirst({
        where: { id: nextPartyId, isActive: true },
        select: { id: true },
      });
      if (!account) throw new BadRequestException('Seçilen cari hesap bulunamadı.');
      data.partyAccountId = nextPartyId;
    } else if (!previousPartyId) {
      throw new BadRequestException(EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: data as any,
      include: { expenseCategory: { include: { parent: true } } },
    });

    if (nextPartyId && this.partyAccounts) {
      await this.partyAccounts.syncExpenseDebit({
        accountId: nextPartyId,
        expenseId: id,
        amount: Number(updated.amount),
        entryDate: updated.date,
        description: String(updated.description ?? '').trim() || 'Masraf',
        userId: _userId,
      });
    }

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
    if (this.partyAccounts) {
      await this.partyAccounts.voidExpenseDebit(id);
    }
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
    if (isCustomerExpenseLane(expenseLaneFromSubject(filters.operationSubject))) {
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

    const where: Record<string, unknown> = { AND: [hasarFileBudgetExpenseWhere()] };
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
          AND: [
            HASAR_FILE_EXPENSE_KIND_WHERE,
            {
              OR: [
                { expenses: { some: {} } },
                { approvedBudgetAmount: { gt: 0 } },
                { budgetVersions: { some: { status: 'approved', totalAmount: { gt: 0 } } } },
              ],
            },
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

  async getSummary(opts?: {
    year?: number;
    month?: number;
    dateFrom?: string;
    dateTo?: string;
    expensePlan?: string;
    operationSubject?: string;
    fileCaseId?: string;
    expenseCategoryParentId?: string;
  }) {
    const now = new Date();
    const y = opts?.year ?? now.getFullYear();
    const m = opts?.month ?? now.getMonth() + 1;
    let startDate = new Date(y, m - 1, 1);
    let endDate = new Date(y, m, 0, 23, 59, 59, 999);
    if (opts?.dateFrom) startDate = new Date(opts.dateFrom);
    if (opts?.dateTo) endDate = new Date(`${opts.dateTo}T23:59:59.999Z`);

    const where: Record<string, unknown> = {
      date: { gte: startDate, lte: endDate },
    };
    if (opts?.expensePlan) where.expensePlan = opts.expensePlan;
    if (opts?.operationSubject) where.operationSubject = opts.operationSubject;
    if (opts?.fileCaseId) where.fileCaseId = opts.fileCaseId;
    if (opts?.expenseCategoryParentId) {
      where.OR = [
        { expenseCategoryId: opts.expenseCategoryParentId },
        { expenseCategory: { parentId: opts.expenseCategoryParentId } },
      ];
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        amount: true,
        expenseGroup: true,
        approvalStatus: true,
        expenseCategory: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byGroup: Record<string, number> = {};
    for (const e of expenses) {
      byGroup[e.expenseGroup] = (byGroup[e.expenseGroup] ?? 0) + Number(e.amount);
    }

    // Grup bazlı analiz — alt grubun bağlı olduğu üst kategori adı
    const byMasrafGrubu = aggregateMasrafByGrup(
      expenses.map((e) => ({
        amount: Number(e.amount),
        expenseGroup: e.expenseGroup,
        expenseCategory: e.expenseCategory,
      })),
    );

    const pending = expenses.filter(e => e.approvalStatus === 'PENDING').length;
    const approved = expenses.filter(e => e.approvalStatus === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      year: y,
      month: m,
      total,
      approved,
      pending,
      byGroup,
      byMasrafGrubu,
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
