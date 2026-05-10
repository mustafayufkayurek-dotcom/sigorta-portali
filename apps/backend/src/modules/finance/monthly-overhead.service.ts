import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateMonthlyOverheadEntryDto,
  AllocateOverheadDto,
} from './dto/create-monthly-overhead.dto';

@Injectable()
export class MonthlyOverheadService {
  private readonly logger = new Logger(MonthlyOverheadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createEntry(dto: CreateMonthlyOverheadEntryDto, userId: string) {
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
        amount: dto.amount,
        description: dto.description,
        source: dto.source ?? 'manual',
        logoEntryRef: dto.logoEntryRef,
        createdByUserId: userId,
      },
      update: {
        amount: dto.amount,
        description: dto.description,
        logoEntryRef: dto.logoEntryRef,
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
        allocations: { select: { id: true, claimFileId: true, allocatedAmount: true } },
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

  async allocate(dto: AllocateOverheadDto) {
    const { year, month, allocationMethod } = dto;

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const activeFiles = await this.prisma.claimFile.findMany({
      where: {
        createdAt: { lte: periodEnd },
        OR: [
          { closedAt: null },
          { closedAt: { gte: periodStart } },
        ],
      },
      select: {
        id: true,
        financialSummary: { select: { fileFeeRevenue: true, totalRevenue: true } },
      },
    });

    if (activeFiles.length === 0) {
      return { allocated: 0, message: 'O dönemde aktif dosya bulunamadı' };
    }

    const overheadEntries = await this.prisma.monthlyOverheadEntry.findMany({
      where: { year, month },
    });

    const totalOverhead = overheadEntries.reduce((s, e) => s + e.amount, 0);

    if (totalOverhead === 0) {
      return { allocated: 0, message: 'Bu dönem için sabit gider girilmemiş' };
    }

    const weights = this.computeWeights(activeFiles, allocationMethod);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of overheadEntries) {
        for (const file of activeFiles) {
          const weight = weights.get(file.id) ?? 0;
          const allocatedAmount = entry.amount * weight;

          if (allocatedAmount <= 0) continue;

          const costEntry = await tx.costEntry.create({
            data: {
              claimFileId: file.id,
              category: 'overhead_allocation',
              description: `Sabit Gider Payı — ${year}/${String(month).padStart(2, '0')}`,
              amount: allocatedAmount,
              vatRate: 0,
              entryDate: periodEnd,
              source: 'overhead_allocation',
              isOverhead: true,
            },
          });

          await tx.overheadAllocation.create({
            data: {
              overheadEntryId: entry.id,
              claimFileId: file.id,
              allocationMethod,
              allocationWeight: weight,
              allocatedAmount,
              costEntryId: costEntry.id,
            },
          });
        }

        await tx.monthlyOverheadEntry.update({
          where: { id: entry.id },
          data: { isAllocated: true, allocatedAt: new Date() },
        });
      }
    });

    this.logger.log(`Overhead dağıtıldı: ${year}/${month} — ${activeFiles.length} dosya, ${totalOverhead} TL`);

    return {
      allocated: activeFiles.length,
      totalOverhead,
      method: allocationMethod,
      periodYear: year,
      periodMonth: month,
    };
  }

  private computeWeights(
    files: Array<{ id: string; financialSummary: { fileFeeRevenue: number; totalRevenue: number } | null }>,
    method: 'equal' | 'proportional_revenue' | 'hybrid',
  ): Map<string, number> {
    const n = files.length;
    const map = new Map<string, number>();

    if (method === 'equal') {
      files.forEach((f) => map.set(f.id, 1 / n));
      return map;
    }

    const totalRevenue = files.reduce(
      (s, f) => s + (f.financialSummary?.totalRevenue ?? 0),
      0,
    );

    if (method === 'proportional_revenue') {
      files.forEach((f) => {
        const rev = f.financialSummary?.totalRevenue ?? 0;
        map.set(f.id, totalRevenue > 0 ? rev / totalRevenue : 1 / n);
      });
      return map;
    }

    // hybrid: %50 eşit + %50 orantılı
    files.forEach((f) => {
      const equalShare = 1 / n;
      const rev = f.financialSummary?.totalRevenue ?? 0;
      const proportionalShare = totalRevenue > 0 ? rev / totalRevenue : 1 / n;
      map.set(f.id, 0.5 * equalShare + 0.5 * proportionalShare);
    });

    return map;
  }
}
