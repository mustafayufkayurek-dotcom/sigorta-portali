import { Injectable, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateMonthlyOverheadEntryDto,
  AllocateOverheadDto,
} from './dto/create-monthly-overhead.dto';
import { FinancialSummaryService } from './financial-summary.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { buildAppPath } from '@/common/utils/app-url';
import { isOverheadCategoryCode, toGrossAmount, toNetAmount } from './overhead.constants';
import {
  allocationTargetKey,
  computeAllocationWeights,
  formatPeriodLabel,
  loadActiveAllocationTargets,
  monthPeriodBounds,
} from './overhead-allocation.helper';
import {
  isLastDayOfMonthIstanbul,
  isOverheadPoolProcessed,
  istanbulDateParts,
} from './overhead-month-end.helper';

const FINANCE_ADMIN_ROLE_CODES = [
  'admin',
  'super_admin',
  'manager',
  'finance',
  'finans',
  'accountant',
];

const ALLOWED_ENTRY_SOURCES = new Set(['expense_pool', 'logo_erp']);

export interface OverheadAllocationReminder {
  year: number;
  month: number;
  periodLabel: string;
  totalNet: number;
  targetCount: number;
  urgency: 'month_end' | 'overdue';
  needsSync: boolean;
  message: string;
}

@Injectable()
export class MonthlyOverheadService {
  private readonly logger = new Logger(MonthlyOverheadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly summaryService: FinancialSummaryService,
    private readonly email: EmailService,
  ) {}

  async createEntry(dto: CreateMonthlyOverheadEntryDto, userId: string) {
    const source = dto.source ?? 'manual';
    if (!ALLOWED_ENTRY_SOURCES.has(source)) {
      throw new BadRequestException(
        'Yönetim giderleri yalnızca masraf havuzundan veya Logo senkronundan aktarılabilir.',
      );
    }

    const category = await this.prisma.expenseCategory.findUnique({ where: { id: dto.expenseCategoryId } });
    if (!category || !isOverheadCategoryCode(category.code)) {
      throw new BadRequestException('Seçilen kategori sabit/yönetim gideri değil');
    }

    const vatRate = dto.vatRate ?? 20;
    const netAmount = dto.amount;
    const grossAmount = dto.grossAmount ?? toGrossAmount(netAmount, vatRate);

    const existing = await this.prisma.monthlyOverheadEntry.findUnique({
      where: {
        year_month_expenseCategoryId: {
          year: dto.year,
          month: dto.month,
          expenseCategoryId: dto.expenseCategoryId,
        },
      },
    });

    if (existing?.isAllocated) {
      throw new ConflictException(
        `${dto.year}/${dto.month} döneminin bu kategorisi zaten dağıtılmış. Düzenlemek için dağıtımı geri alın.`,
      );
    }

    return this.prisma.monthlyOverheadEntry.upsert({
      where: {
        year_month_expenseCategoryId: {
          year: dto.year,
          month: dto.month,
          expenseCategoryId: dto.expenseCategoryId,
        },
      },
      create: {
        year: dto.year,
        month: dto.month,
        expenseCategoryId: dto.expenseCategoryId,
        amount: netAmount,
        vatRate,
        grossAmount,
        description: dto.description,
        source,
        logoEntryRef: dto.logoEntryRef,
        createdByUserId: userId,
      },
      update: {
        amount: netAmount,
        vatRate,
        grossAmount,
        description: dto.description,
        logoEntryRef: dto.logoEntryRef,
        source,
      },
    });
  }

  async findAll(year?: number, month?: number) {
    return this.prisma.monthlyOverheadEntry.findMany({
      where: {
        ...(year && { year }),
        ...(month && { month }),
      },
      include: {
        expenseCategory: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        allocations: {
          select: {
            id: true,
            claimFileId: true,
            emergencyCaseId: true,
            allocatedAmount: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getMonthTotals(year: number, month: number): Promise<number> {
    const result = await this.prisma.monthlyOverheadEntry.aggregate({
      where: { year, month },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  /** Masraf izlemedeki havuz giderlerini (dosyasız yönetim giderleri) aylık tabloya aktar */
  async syncFromExpensePool(year: number, month: number, userId: string) {
    const { periodStart, periodEnd } = monthPeriodBounds(year, month);

    const poolExpenses = await this.prisma.expense.findMany({
      where: {
        isOverheadPool: true,
        overheadAllocatedAt: null,
        fileCaseId: null,
        expenseGroup: 'YONETIM_GIDERLERI',
        date: { gte: periodStart, lte: periodEnd },
        approvalStatus: { in: ['APPROVED', 'PENDING'] },
      },
      include: { expenseCategory: true },
    });

    if (poolExpenses.length === 0) {
      return { synced: 0, categories: 0, totalNet: 0 };
    }

    const byCategory = new Map<string, { net: number; gross: number; vatRate: number; count: number }>();
    for (const e of poolExpenses) {
      const catId = e.expenseCategoryId;
      if (!catId || !e.expenseCategory || !isOverheadCategoryCode(e.expenseCategory.code)) continue;
      const net = toNetAmount(Number(e.amount), e.vatRate, e.vatIncluded);
      const cur = byCategory.get(catId) ?? { net: 0, gross: 0, vatRate: e.vatRate, count: 0 };
      cur.net += net;
      cur.gross += Number(e.amount);
      cur.count += 1;
      byCategory.set(catId, cur);
    }

    let synced = 0;
    for (const [expenseCategoryId, agg] of byCategory) {
      await this.createEntry(
        {
          year,
          month,
          expenseCategoryId,
          amount: Math.round(agg.net * 100) / 100,
          vatRate: agg.vatRate,
          grossAmount: Math.round(agg.gross * 100) / 100,
          description: `Masraf havuzundan (${agg.count} kalem)`,
          source: 'expense_pool',
        },
        userId,
      );
      synced += 1;
    }

    return {
      synced,
      categories: byCategory.size,
      totalNet: [...byCategory.values()].reduce((s, v) => s + v.net, 0),
      expenseCount: poolExpenses.length,
    };
  }

  async getAllocationPreview(year: number, month: number, allocationMethod: AllocateOverheadDto['allocationMethod'] = 'equal') {
    const overheadEntries = await this.loadOverheadEntries(year, month);
    const totalOverhead = overheadEntries.reduce((s, e) => s + e.amount, 0);
    const targets = await loadActiveAllocationTargets(this.prisma, year, month);

    if (targets.length === 0) {
      return {
        year,
        month,
        allocationMethod,
        totalNetOverhead: totalOverhead,
        fileCount: 0,
        perFileShare: 0,
        files: [],
        breakdown: { hasar: 0, ozelOperasyon: 0, acilYardim: 0 },
        entries: overheadEntries.map((e) => ({
          id: e.id,
          category: e.expenseCategory?.name,
          netAmount: e.amount,
          vatRate: e.vatRate,
          grossAmount: e.grossAmount,
        })),
        message: 'Dağıtım için uygun aktif dosya bulunamadı (hasar, özel operasyon, acil yardım)',
      };
    }

    const weights = computeAllocationWeights(targets, allocationMethod);
    const perFileShare = totalOverhead / targets.length;

    return {
      year,
      month,
      allocationMethod,
      totalNetOverhead: totalOverhead,
      fileCount: targets.length,
      perFileShare: Math.round(perFileShare * 100) / 100,
      breakdown: {
        hasar: targets.filter((t) => t.fileType === 'hasar').length,
        ozelOperasyon: targets.filter((t) => t.fileType === 'ozel_operasyon').length,
        acilYardim: targets.filter((t) => t.fileType === 'acil_yardim').length,
      },
      files: targets.map((t) => {
        const weight = weights.get(allocationTargetKey(t.type, t.id)) ?? 0;
        return {
          targetType: t.type,
          fileCaseId: t.type === 'claim' ? t.id : undefined,
          emergencyCaseId: t.type === 'emergency' ? t.id : undefined,
          fileNo: t.label,
          fileType: t.fileType,
          fileTypeLabel: t.fileTypeLabel,
          weight,
          allocatedAmount: Math.round(totalOverhead * weight * 100) / 100,
          approvedBudget: t.approvedBudget,
        };
      }),
      entries: overheadEntries.map((e) => ({
        id: e.id,
        category: e.expenseCategory?.name,
        netAmount: e.amount,
        vatRate: e.vatRate,
        grossAmount: e.grossAmount,
        perFileAmount: Math.round((e.amount / targets.length) * 100) / 100,
      })),
    };
  }

  async allocate(dto: AllocateOverheadDto, userId: string) {
    const { year, month, allocationMethod } = dto;
    const { periodStart, periodEnd } = monthPeriodBounds(year, month);
    const overheadEntries = await this.loadOverheadEntries(year, month);
    const totalOverhead = overheadEntries.reduce((s, e) => s + e.amount, 0);
    const targets = await loadActiveAllocationTargets(this.prisma, year, month);

    if (targets.length === 0) {
      return { allocated: 0, message: 'Dağıtım için uygun aktif dosya bulunamadı' };
    }

    if (totalOverhead === 0) {
      return { allocated: 0, message: 'Bu dönem için havuzdan aktarılmış yönetim gideri yok' };
    }

    if (overheadEntries.some((e) => e.isAllocated)) {
      throw new ConflictException('Bu dönemin giderleri zaten dağıtılmış');
    }

    const weights = computeAllocationWeights(targets, allocationMethod);
    const claimFileIds = targets.filter((t) => t.type === 'claim').map((t) => t.id);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of overheadEntries) {
        const catName = entry.expenseCategory?.name ?? 'Sabit Gider';
        for (const target of targets) {
          const weight = weights.get(allocationTargetKey(target.type, target.id)) ?? 0;
          const allocatedAmount = Math.round(entry.amount * weight * 100) / 100;

          if (allocatedAmount <= 0) continue;

          const periodLabel = `${year}/${String(month).padStart(2, '0')}`;
          const description = `${catName} payı (KDV hariç) — ${periodLabel}`;

          if (target.type === 'claim') {
            const costEntry = await tx.costEntry.create({
              data: {
                claimFileId: target.id,
                category: 'overhead_allocation',
                description,
                amount: allocatedAmount,
                vatRate: 0,
                entryDate: periodEnd,
                source: 'overhead_allocation',
                isOverhead: true,
                expenseCategoryId: entry.expenseCategoryId,
              },
            });

            await tx.overheadAllocation.create({
              data: {
                overheadEntryId: entry.id,
                claimFileId: target.id,
                allocationMethod,
                allocationWeight: weight,
                allocatedAmount,
                costEntryId: costEntry.id,
              },
            });
          } else {
            const emergencyCostEntry = await tx.emergencyCostEntry.create({
              data: {
                caseId: target.id,
                entryType: 'gider',
                description,
                amount: allocatedAmount,
                entryDate: periodEnd,
                isOverhead: true,
                source: 'overhead_allocation',
                expenseCategoryId: entry.expenseCategoryId,
                createdByUserId: userId,
              },
            });

            await tx.overheadAllocation.create({
              data: {
                overheadEntryId: entry.id,
                emergencyCaseId: target.id,
                allocationMethod,
                allocationWeight: weight,
                allocatedAmount,
                emergencyCostEntryId: emergencyCostEntry.id,
              },
            });
          }
        }

        await tx.monthlyOverheadEntry.update({
          where: { id: entry.id },
          data: { isAllocated: true, allocatedAt: new Date() },
        });
      }

      await tx.expense.updateMany({
        where: {
          isOverheadPool: true,
          overheadAllocatedAt: null,
          fileCaseId: null,
          expenseGroup: 'YONETIM_GIDERLERI',
          date: { gte: periodStart, lte: periodEnd },
        },
        data: { overheadAllocatedAt: new Date() },
      });
    });

    for (const fileId of claimFileIds) {
      await this.summaryService.recalculate(fileId);
    }

    this.logger.log(
      `Overhead dağıtıldı: ${year}/${month} — ${targets.length} dosya, ${totalOverhead} TL (KDV hariç)`,
    );

    return {
      allocated: targets.length,
      totalOverhead,
      method: allocationMethod,
      periodYear: year,
      periodMonth: month,
      breakdown: {
        hasar: targets.filter((t) => t.fileType === 'hasar').length,
        ozelOperasyon: targets.filter((t) => t.fileType === 'ozel_operasyon').length,
        acilYardim: targets.filter((t) => t.fileType === 'acil_yardim').length,
      },
    };
  }

  /** Ay sonu / gecikmiş dönemler için dağıtım hatırlatması */
  async getAllocationReminders(): Promise<{
    reminders: OverheadAllocationReminder[];
    hasPending: boolean;
    criticalCount: number;
  }> {
    const now = new Date();
    const reminders: OverheadAllocationReminder[] = [];
    const MONTH_END_START_DAY = 25;

    for (let offset = 0; offset <= 6; offset += 1) {
      const anchor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const year = anchor.getFullYear();
      const month = anchor.getMonth() + 1;
      const { periodEnd } = monthPeriodBounds(year, month);

      const isCurrentMonth = offset === 0;
      const isPastMonth = periodEnd < now;
      const isMonthEndWindow =
        isCurrentMonth && now.getDate() >= MONTH_END_START_DAY && now <= periodEnd;

      const status = await this.getPeriodAllocationStatus(year, month);

      const hasWork =
        status.needsSync
        || status.needsAllocation
        || status.poolExpenseCount > 0
        || status.entryCount > 0;

      const distributionDone =
        status.entryCount > 0 && status.allocationComplete;

      const includePast = isPastMonth && !status.allocationComplete && hasWork;
      const includeCurrentPending = isCurrentMonth && hasWork && !status.allocationComplete;
      // Ayın 25'inden itibaren: dağıtım tamamlanmadıysa veya havuz henüz kontrol edilmediyse hatırlat
      const includeMonthEndChecklist =
        isCurrentMonth && isMonthEndWindow && !distributionDone;

      if (!includePast && !includeCurrentPending && !includeMonthEndChecklist) continue;

      const urgency: OverheadAllocationReminder['urgency'] = isPastMonth ? 'overdue' : 'month_end';
      const periodLabel = formatPeriodLabel(year, month);
      const amountText = `${Math.round(status.totalNet).toLocaleString('tr-TR')} ₺`;

      let message: string;
      if (includeMonthEndChecklist) {
        message = hasWork
          ? `${periodLabel} ayı kapanıyor — havuzdaki yönetim giderlerini (${amountText}) aktarıp dosyalara dağıtın.`
          : `${periodLabel} ayı kapanıyor — Masraf İzleme'de yönetim gideri havuzunu kontrol edin; kayıt varsa aktarıp dosyalara dağıtın.`;
      } else if (status.needsSync) {
        message = isPastMonth
          ? `${periodLabel} yönetim gideri havuzu (${amountText}) henüz aktarılmadı ve dağıtılmadı.`
          : `${periodLabel} — havuzdaki yönetim giderlerini aktarıp dosyalara dağıtın (${amountText}).`;
      } else {
        message = isPastMonth
          ? `${periodLabel} yönetim gideri (${amountText}) dosyalara dağıtılmadı.`
          : `${periodLabel} — ${amountText} tutarındaki yönetim giderini dosyalara dağıtın.`;
      }

      reminders.push({
        year,
        month,
        periodLabel,
        totalNet: status.totalNet,
        targetCount: status.targetCount,
        urgency,
        needsSync: status.needsSync,
        message,
      });
    }

    const criticalCount = reminders.filter((r) => r.urgency === 'overdue').length;
    return {
      reminders,
      hasPending: reminders.length > 0,
      criticalCount,
    };
  }

  async getPeriodAllocationStatus(year: number, month: number) {
    const { periodStart, periodEnd } = monthPeriodBounds(year, month);
    const overheadEntries = await this.loadOverheadEntries(year, month);
    const entryTotal = overheadEntries.reduce((s, e) => s + e.amount, 0);
    const allEntriesAllocated = overheadEntries.length > 0 && overheadEntries.every((e) => e.isAllocated);

    const poolAgg = await this.prisma.expense.aggregate({
      where: {
        isOverheadPool: true,
        fileCaseId: null,
        expenseGroup: 'YONETIM_GIDERLERI',
        date: { gte: periodStart, lte: periodEnd },
        approvalStatus: { in: ['APPROVED', 'PENDING'] },
      },
      _sum: { amount: true },
      _count: true,
    });

    const unallocatedPoolCount = await this.prisma.expense.count({
      where: {
        isOverheadPool: true,
        overheadAllocatedAt: null,
        fileCaseId: null,
        expenseGroup: 'YONETIM_GIDERLERI',
        date: { gte: periodStart, lte: periodEnd },
        approvalStatus: { in: ['APPROVED', 'PENDING'] },
      },
    });

    const poolHasItems = (poolAgg._count ?? 0) > 0;
    const needsSync = unallocatedPoolCount > 0;
    const hasUnallocatedEntries = overheadEntries.some((e) => !e.isAllocated);
    const totalNet = entryTotal > 0 ? entryTotal : Number(poolAgg._sum.amount ?? 0);

    const allocationComplete =
      unallocatedPoolCount === 0
      && (overheadEntries.length === 0 || allEntriesAllocated);

    const needsAllocation =
      !allocationComplete
      && (needsSync || hasUnallocatedEntries || (poolHasItems && overheadEntries.length === 0));

    const targets = needsAllocation
      ? await loadActiveAllocationTargets(this.prisma, year, month)
      : [];

    return {
      needsAllocation,
      needsSync,
      allocationComplete,
      totalNet,
      targetCount: targets.length,
      entryCount: overheadEntries.length,
      poolExpenseCount: poolAgg._count ?? 0,
    };
  }

  /**
   * Ayın son günü: havuz gideri işlenmediyse finans ve yöneticiye panel + e-posta.
   * Araç kirası / maaş tek dosyaya yazılmaz; havuz + dağıtım gerekir.
   */
  async sendLastDayPoolReminders(now = new Date()): Promise<{
    sent: number;
    emailed: number;
    skipped?: string;
  }> {
    if (!isLastDayOfMonthIstanbul(now)) {
      return { sent: 0, emailed: 0, skipped: 'not_last_day' };
    }

    const { year, month } = istanbulDateParts(now);
    const status = await this.getPeriodAllocationStatus(year, month);
    if (isOverheadPoolProcessed(status)) {
      return { sent: 0, emailed: 0, skipped: 'processed' };
    }

    const periodLabel = formatPeriodLabel(year, month);
    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    const title = `Yönetim gideri havuzu — ${periodLabel}`;
    const body =
      `${periodLabel} ayı kapanıyor. Araç kirası, maaş, SGK ve vergiler tek dosyaya yazılmaz. `
      + 'Finans → Sabit Giderler’de bu ayın havuzunu işleyip açık dosyalara dağıtın.';
    const actionUrl = buildAppPath(process.env, `/panel/finans/sabit-giderler?year=${year}&month=${month}`);

    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: FINANCE_ADMIN_ROLE_CODES } },
      },
      select: { id: true, email: true },
    });
    if (recipients.length === 0) {
      return { sent: 0, emailed: 0, skipped: 'no_recipients' };
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    let sent = 0;
    let emailed = 0;
    for (const user of recipients) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: 'overhead_month_end',
          relatedEntityId: periodKey,
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      });
      if (!existing) {
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'overhead_month_end',
            title,
            body,
            channel: 'in_app',
            status: 'unread',
            relatedEntityType: 'monthly_overhead',
            relatedEntityId: periodKey,
          },
        });
        sent += 1;
      }

      if (user.email) {
        const mail = await this.email.sendTemplateEmail(user.email, title, {
          title,
          badgeLabel: 'Ay sonu',
          greeting: 'Merhaba',
          summaryTitle: 'Havuz henüz işlenmedi',
          bodyNote: body,
          nextStepTitle: 'Ne yapılacak',
          nextStepText:
            'Yönetim giderlerini havuza kaydedin, ardından aynı ay için dosyalara dağıtın.',
          actionUrl,
          actionLabel: 'Sabit Giderler',
          rows: [
            { label: 'Dönem', value: periodLabel },
            { label: 'Havuz kayıt', value: String(status.poolExpenseCount) },
            { label: 'Dağıtım', value: status.allocationComplete ? 'Tamam' : 'Bekliyor' },
          ],
        });
        if (mail.sent) emailed += 1;
      }
    }

    this.logger.log(
      `Ay sonu havuz hatırlatması: ${periodLabel} — panel=${sent}, e-posta=${emailed}`,
    );
    return { sent, emailed };
  }

  private async loadOverheadEntries(year: number, month: number) {
    return this.prisma.monthlyOverheadEntry.findMany({
      where: { year, month },
      include: { expenseCategory: { select: { id: true, name: true, code: true } } },
    });
  }
}
