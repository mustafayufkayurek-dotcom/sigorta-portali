import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BranchDistributionFiltersDto,
  BranchTrendFiltersDto,
  CustomerPerformanceFiltersDto,
  BranchAlertsFiltersDto,
  StaffPerformanceFiltersDto,
  ClosureSpeedFiltersDto,
  ProfitabilityFiltersDto,
} from './dto/analytics-filters.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Branş Dağılımı ───────────────────────────────────────────────────────

  async getBranchDistribution(filters: BranchDistributionFiltersDto) {
    const where: Record<string, unknown> = {};

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.createdAt as Record<string, Date>).lte = new Date(filters.dateTo);
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    const files = await this.prisma.claimFile.findMany({
      where,
      select: {
        id: true,
        productBranch: true,
        closedAt: true,
        createdAt: true,
        currentStatus: { select: { isClosedState: true } },
      },
    });

    const branchMap = new Map<
      string,
      { branch: string; total: number; open: number; closed: number; closeDays: number[]; lastDate: Date | null }
    >();

    for (const file of files) {
      const branch = file.productBranch || 'Belirtilmemiş';
      if (!branchMap.has(branch)) {
        branchMap.set(branch, { branch, total: 0, open: 0, closed: 0, closeDays: [], lastDate: null });
      }
      const entry = branchMap.get(branch)!;
      entry.total++;

      const isClosed = file.currentStatus?.isClosedState ?? !!file.closedAt;
      if (isClosed) {
        entry.closed++;
        if (file.closedAt) {
          const days = Math.round(
            (file.closedAt.getTime() - file.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (days >= 0) entry.closeDays.push(days);
        }
      } else {
        entry.open++;
      }

      if (!entry.lastDate || file.createdAt > entry.lastDate) {
        entry.lastDate = file.createdAt;
      }
    }

    const rows = Array.from(branchMap.values())
      .map((e) => ({
        branch: e.branch,
        total: e.total,
        open: e.open,
        closed: e.closed,
        avgCloseDays:
          e.closeDays.length > 0
            ? Math.round(e.closeDays.reduce((a, b) => a + b, 0) / e.closeDays.length)
            : null,
        lastFileDate: e.lastDate?.toISOString() ?? null,
      }))
      .sort((a, b) => b.total - a.total);

    const totalFiles = files.length;
    const mostActiveBranch = rows[0]?.branch ?? null;
    const allCloseDays = rows.flatMap((r) =>
      r.avgCloseDays !== null ? [r.avgCloseDays] : [],
    );
    const overallAvgCloseDays =
      allCloseDays.length > 0
        ? Math.round(allCloseDays.reduce((a, b) => a + b, 0) / allCloseDays.length)
        : null;

    return {
      rows,
      summary: {
        totalFiles,
        mostActiveBranch,
        avgCloseDays: overallAvgCloseDays,
        branchCount: rows.length,
      },
    };
  }

  // ── Aylık Branş Trendi ───────────────────────────────────────────────────

  async getBranchTrend(filters: BranchTrendFiltersDto) {
    const months = filters.months ?? 12;
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (filters.customerId) where.customerId = filters.customerId;

    const files = await this.prisma.claimFile.findMany({
      where,
      select: { id: true, productBranch: true, createdAt: true },
    });

    // Ay listesi oluştur
    const monthKeys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Branşlar kümesi
    const branches = new Set<string>();
    files.forEach((f) => branches.add(f.productBranch || 'Belirtilmemiş'));

    // month → branch → count
    const grid = new Map<string, Map<string, number>>();
    monthKeys.forEach((m) => grid.set(m, new Map()));

    files.forEach((f) => {
      const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const branch = f.productBranch || 'Belirtilmemiş';
      if (grid.has(key)) {
        const row = grid.get(key)!;
        row.set(branch, (row.get(branch) ?? 0) + 1);
      }
    });

    const trend = monthKeys.map((month) => {
      const row: Record<string, unknown> = { month };
      branches.forEach((b) => {
        row[b] = grid.get(month)?.get(b) ?? 0;
      });
      return row;
    });

    return { trend, branches: Array.from(branches) };
  }

  // ── Müşteri Performans Metrikleri ────────────────────────────────────────

  async getCustomerPerformance(filters: CustomerPerformanceFiltersDto) {
    const where: Record<string, unknown> = {};

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(filters.dateFrom);
      if (filters.dateTo) (where.createdAt as Record<string, Date>).lte = new Date(filters.dateTo);
    }

    if (filters.branch) where.productBranch = filters.branch;

    const customers = await this.prisma.customer.findMany({
      where: {
        status: 'active',
        ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        companyName: true,
        entityType: true,
        serviceType: true,
        serviceBranches: true,
        claimFiles: {
          where,
          select: {
            id: true,
            productBranch: true,
            createdAt: true,
            closedAt: true,
            currentStatus: { select: { isClosedState: true } },
          },
        },
      },
    });

    const result = customers
      .filter((c) => c.claimFiles.length > 0)
      .map((c) => {
        const files = c.claimFiles;
        const closed = files.filter((f) => f.currentStatus?.isClosedState || f.closedAt);
        const open = files.length - closed.length;

        const closeDays = closed
          .filter((f) => f.closedAt)
          .map((f) =>
            Math.round(
              (f.closedAt!.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
          .filter((d) => d >= 0);

        const avgCloseDays =
          closeDays.length > 0
            ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length)
            : null;

        // Branş dağılımı
        const branchDist: Record<string, number> = {};
        files.forEach((f) => {
          const b = f.productBranch || 'Belirtilmemiş';
          branchDist[b] = (branchDist[b] ?? 0) + 1;
        });

        // Son 3 ay ve önceki 3 ay karşılaştırması → trend
        const now = new Date();
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        const recent = files.filter((f) => f.createdAt >= threeMonthsAgo).length;
        const previous = files.filter(
          (f) => f.createdAt >= sixMonthsAgo && f.createdAt < threeMonthsAgo,
        ).length;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (recent > previous * 1.1) trend = 'up';
        else if (recent < previous * 0.9) trend = 'down';

        const displayName =
          c.entityType === 'corporate'
            ? (c.companyName ?? c.fullName ?? 'İsimsiz')
            : (c.fullName ?? (`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'İsimsiz'));

        return {
          customerId: c.id,
          customerName: displayName,
          entityType: c.entityType,
          serviceType: c.serviceType,
          totalFiles: files.length,
          openFiles: open,
          closedFiles: closed.length,
          avgCloseDays,
          branchDistribution: branchDist,
          trend,
          recentFiles: recent,
        };
      })
      .sort((a, b) => b.totalFiles - a.totalFiles);

    return { customers: result, total: result.length };
  }

  // ── Uyarılar ─────────────────────────────────────────────────────────────

  async getBranchAlerts(filters: BranchAlertsFiltersDto) {
    const months = filters.months ?? 3;
    const now = new Date();

    const cutoff = new Date(now);
    cutoff.setMonth(now.getMonth() - months);

    const prevCutoff = new Date(now);
    prevCutoff.setMonth(now.getMonth() - months * 2);

    // Tüm son dönem dosyaları
    const [recentFiles, prevFiles, allClosedFiles] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: { createdAt: { gte: cutoff } },
        select: {
          customerId: true,
          productBranch: true,
          createdAt: true,
          closedAt: true,
          customer: { select: { id: true, fullName: true, companyName: true, entityType: true } },
          currentStatus: { select: { isClosedState: true } },
        },
      }),
      this.prisma.claimFile.findMany({
        where: { createdAt: { gte: prevCutoff, lt: cutoff } },
        select: { customerId: true, productBranch: true },
      }),
      this.prisma.claimFile.findMany({
        where: { closedAt: { not: null }, createdAt: { gte: prevCutoff } },
        select: { productBranch: true, createdAt: true, closedAt: true },
      }),
    ]);

    // 1. Dosya göndermeyi bırakan müşteriler
    const prevCustomerSet = new Set(prevFiles.map((f) => f.customerId).filter(Boolean));
    const recentCustomerSet = new Set(recentFiles.map((f) => f.customerId).filter(Boolean));
    const stoppedCustomers: { customerId: string; customerName: string; lastFileDate?: string }[] = [];

    for (const customerId of prevCustomerSet) {
      if (!recentCustomerSet.has(customerId) && customerId) {
        const lastFile = await this.prisma.claimFile.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            customer: { select: { id: true, fullName: true, companyName: true, entityType: true } },
          },
        });
        if (lastFile?.customer) {
          const c = lastFile.customer;
          const name =
            c.entityType === 'corporate' ? (c.companyName ?? c.fullName ?? '') : (c.fullName ?? '');
          stoppedCustomers.push({
            customerId,
            customerName: name,
            lastFileDate: lastFile.createdAt.toISOString(),
          });
        }
      }
    }

    // 2. Ani artış gösteren branşlar
    const recentBranch = new Map<string, number>();
    const prevBranch = new Map<string, number>();

    recentFiles.forEach((f) => {
      const b = f.productBranch || 'Belirtilmemiş';
      recentBranch.set(b, (recentBranch.get(b) ?? 0) + 1);
    });
    prevFiles.forEach((f) => {
      const b = f.productBranch || 'Belirtilmemiş';
      prevBranch.set(b, (prevBranch.get(b) ?? 0) + 1);
    });

    const surgingBranches: { branch: string; previousCount: number; currentCount: number; growthRate: number }[] = [];
    recentBranch.forEach((current, branch) => {
      const previous = prevBranch.get(branch) ?? 0;
      if (previous > 0) {
        const growthRate = ((current - previous) / previous) * 100;
        if (growthRate >= 50) {
          surgingBranches.push({ branch, previousCount: previous, currentCount: current, growthRate: Math.round(growthRate) });
        }
      } else if (current >= 5) {
        surgingBranches.push({ branch, previousCount: 0, currentCount: current, growthRate: 100 });
      }
    });
    surgingBranches.sort((a, b) => b.growthRate - a.growthRate);

    // 3. Ortalamadan çok yavaş kapanan branşlar
    const branchCloseDays = new Map<string, number[]>();
    allClosedFiles.forEach((f) => {
      if (f.closedAt) {
        const branch = f.productBranch || 'Belirtilmemiş';
        const days = Math.round(
          (f.closedAt.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (days >= 0) {
          if (!branchCloseDays.has(branch)) branchCloseDays.set(branch, []);
          branchCloseDays.get(branch)!.push(days);
        }
      }
    });

    const branchAvgs: { branch: string; avgDays: number; count: number }[] = [];
    branchCloseDays.forEach((days, branch) => {
      const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      branchAvgs.push({ branch, avgDays: avg, count: days.length });
    });

    const overallAvg =
      branchAvgs.length > 0
        ? Math.round(branchAvgs.reduce((a, b) => a + b.avgDays, 0) / branchAvgs.length)
        : 30;

    const slowBranches = branchAvgs
      .filter((b) => b.avgDays > overallAvg * 1.3 && b.count >= 3)
      .sort((a, b) => b.avgDays - a.avgDays)
      .map((b) => ({ ...b, overallAvgDays: overallAvg }));

    return {
      stoppedCustomers,
      surgingBranches,
      slowBranches,
      overallAvgCloseDays: overallAvg,
      period: { months, from: cutoff.toISOString(), to: now.toISOString() },
    };
  }

  // ── Personel Performansı ─────────────────────────────────────────────────

  async getStaffPerformance(filters: StaffPerformanceFiltersDto) {
    const days = filters.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const files = await this.prisma.claimFile.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        closedAt: true,
        assignedOfficeUserId: true,
        assignedFieldUserId: true,
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
        assignedFieldUser: { select: { id: true, firstName: true, lastName: true } },
        currentStatus: { select: { isClosedState: true } },
      },
    });

    const staffMap = new Map<string, {
      id: string;
      name: string;
      assigned: number;
      closed: number;
      closeDays: number[];
    }>();

    const addOrUpdate = (
      userId: string,
      name: string,
      isClosed: boolean,
      closeDays: number | null,
    ) => {
      if (!staffMap.has(userId)) {
        staffMap.set(userId, { id: userId, name, assigned: 0, closed: 0, closeDays: [] });
      }
      const entry = staffMap.get(userId)!;
      entry.assigned++;
      if (isClosed) {
        entry.closed++;
        if (closeDays !== null && closeDays >= 0) entry.closeDays.push(closeDays);
      }
    };

    for (const f of files) {
      const isClosed = f.currentStatus?.isClosedState ?? !!f.closedAt;
      const closeDays =
        isClosed && f.closedAt
          ? Math.round((f.closedAt.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : null;

      if (f.assignedOfficeUser) {
        addOrUpdate(
          f.assignedOfficeUser.id,
          `${f.assignedOfficeUser.firstName} ${f.assignedOfficeUser.lastName}`.trim(),
          isClosed,
          closeDays,
        );
      }
      if (f.assignedFieldUser && f.assignedFieldUserId !== f.assignedOfficeUserId) {
        addOrUpdate(
          f.assignedFieldUser.id,
          `${f.assignedFieldUser.firstName} ${f.assignedFieldUser.lastName}`.trim(),
          isClosed,
          closeDays,
        );
      }
    }

    const rows = Array.from(staffMap.values())
      .map((s) => ({
        userId: s.id,
        userName: s.name,
        assigned: s.assigned,
        closed: s.closed,
        openCount: s.assigned - s.closed,
        openRate: s.assigned > 0 ? Math.round(((s.assigned - s.closed) / s.assigned) * 100) : 0,
        avgCloseDays:
          s.closeDays.length > 0
            ? Math.round(s.closeDays.reduce((a, b) => a + b, 0) / s.closeDays.length)
            : null,
      }))
      .sort((a, b) => b.assigned - a.assigned);

    const validAvgRows = rows.filter((r) => r.avgCloseDays !== null);
    const fastest = validAvgRows.length > 0
      ? validAvgRows.reduce((a, b) => (a.avgCloseDays! < b.avgCloseDays! ? a : b))
      : null;
    const slowest = validAvgRows.length > 0
      ? validAvgRows.reduce((a, b) => (a.avgCloseDays! > b.avgCloseDays! ? a : b))
      : null;

    return {
      rows,
      summary: {
        staffCount: rows.length,
        totalAssigned: rows.reduce((s, r) => s + r.assigned, 0),
        totalClosed: rows.reduce((s, r) => s + r.closed, 0),
        fastestStaff: fastest ? { userId: fastest.userId, userName: fastest.userName, avgCloseDays: fastest.avgCloseDays } : null,
        slowestStaff: slowest ? { userId: slowest.userId, userName: slowest.userName, avgCloseDays: slowest.avgCloseDays } : null,
      },
      period: { days, from: since.toISOString(), to: new Date().toISOString() },
    };
  }

  // ── Dosya Kapama Hızı ───────────────────────────────────────────────────

  async getClosureSpeed(filters: ClosureSpeedFiltersDto) {
    const months = filters.months ?? 6;
    const targetDays = filters.targetDays ?? 15;

    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const closedFiles = await this.prisma.claimFile.findMany({
      where: {
        closedAt: { not: null, gte: since },
      },
      select: {
        id: true,
        productBranch: true,
        createdAt: true,
        closedAt: true,
      },
    });

    // Genel ortalama
    const allDays = closedFiles
      .filter((f) => f.closedAt)
      .map((f) => Math.round((f.closedAt!.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
      .filter((d) => d >= 0);

    const overallAvg =
      allDays.length > 0 ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : null;

    // Branş bazlı ortalama
    const branchMap = new Map<string, number[]>();
    for (const f of closedFiles) {
      const branch = f.productBranch || 'Belirtilmemiş';
      const d = f.closedAt
        ? Math.round((f.closedAt.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      if (d !== null && d >= 0) {
        if (!branchMap.has(branch)) branchMap.set(branch, []);
        branchMap.get(branch)!.push(d);
      }
    }

    const byBranch = Array.from(branchMap.entries()).map(([branch, days]) => ({
      branch,
      avgCloseDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      count: days.length,
      slaCompliant: days.filter((d) => d <= targetDays).length,
      slaRate: Math.round((days.filter((d) => d <= targetDays).length / days.length) * 100),
    })).sort((a, b) => a.avgCloseDays - b.avgCloseDays);

    // Aylık trend
    const monthKeys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const monthlyMap = new Map<string, number[]>();
    monthKeys.forEach((m) => monthlyMap.set(m, []));

    for (const f of closedFiles) {
      if (!f.closedAt) continue;
      const key = `${f.closedAt.getFullYear()}-${String(f.closedAt.getMonth() + 1).padStart(2, '0')}`;
      const d = Math.round((f.closedAt.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (d >= 0 && monthlyMap.has(key)) monthlyMap.get(key)!.push(d);
    }

    const trend = monthKeys.map((month) => {
      const days = monthlyMap.get(month) ?? [];
      const avg = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
      const slaRate = days.length > 0
        ? Math.round((days.filter((d) => d <= targetDays).length / days.length) * 100)
        : null;
      return { month, avgCloseDays: avg, count: days.length, target: targetDays, slaRate };
    });

    // Genel SLA uyum oranı
    const slaCompliantAll = allDays.filter((d) => d <= targetDays).length;
    const slaRate = allDays.length > 0 ? Math.round((slaCompliantAll / allDays.length) * 100) : null;

    return {
      overallAvgCloseDays: overallAvg,
      targetDays,
      slaComplianceRate: slaRate,
      byBranch,
      trend,
    };
  }

  // ── Karlılık Metrikleri ─────────────────────────────────────────────────

  async getProfitability(filters: ProfitabilityFiltersDto) {
    const months = filters.months ?? 6;

    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    // Bu ay sınırları
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const [currentMonthFiles, trendFiles] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: { createdAt: { gte: thisMonthStart } },
        select: {
          id: true,
          productBranch: true,
          invoicedAmount: true,
          actualCostAmount: true,
          profitAmount: true,
          estimatedCostAmount: true,
        },
      }),
      this.prisma.claimFile.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          productBranch: true,
          createdAt: true,
          invoicedAmount: true,
          actualCostAmount: true,
          profitAmount: true,
        },
      }),
    ]);

    // Bu ay özeti
    const totalRevenue = currentMonthFiles.reduce((s, f) => s + (f.invoicedAmount ?? 0), 0);
    const totalCost = currentMonthFiles.reduce((s, f) => s + (f.actualCostAmount ?? 0), 0);
    const totalProfit = currentMonthFiles.reduce((s, f) => s + (f.profitAmount ?? (f.invoicedAmount ?? 0) - (f.actualCostAmount ?? 0)), 0);
    const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 10) / 10 : null;

    // Branş bazlı karlılık
    const branchProfMap = new Map<string, { revenue: number; cost: number; profit: number; count: number }>();
    for (const f of currentMonthFiles) {
      const branch = f.productBranch || 'Belirtilmemiş';
      if (!branchProfMap.has(branch)) branchProfMap.set(branch, { revenue: 0, cost: 0, profit: 0, count: 0 });
      const entry = branchProfMap.get(branch)!;
      const rev = f.invoicedAmount ?? 0;
      const cost = f.actualCostAmount ?? 0;
      const prof = f.profitAmount ?? (rev - cost);
      entry.revenue += rev;
      entry.cost += cost;
      entry.profit += prof;
      entry.count++;
    }

    const byBranch = Array.from(branchProfMap.entries()).map(([branch, v]) => ({
      branch,
      revenue: Math.round(v.revenue),
      cost: Math.round(v.cost),
      profit: Math.round(v.profit),
      margin: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 100 * 10) / 10 : null,
      count: v.count,
    })).sort((a, b) => b.profit - a.profit);

    // Aylık trend
    const monthKeys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const monthlyMap = new Map<string, { revenue: number; cost: number; profit: number; count: number }>();
    monthKeys.forEach((m) => monthlyMap.set(m, { revenue: 0, cost: 0, profit: 0, count: 0 }));

    for (const f of trendFiles) {
      const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) continue;
      const entry = monthlyMap.get(key)!;
      const rev = f.invoicedAmount ?? 0;
      const cost = f.actualCostAmount ?? 0;
      const prof = f.profitAmount ?? (rev - cost);
      entry.revenue += rev;
      entry.cost += cost;
      entry.profit += prof;
      entry.count++;
    }

    const trend = monthKeys.map((month) => {
      const v = monthlyMap.get(month)!;
      return {
        month,
        revenue: Math.round(v.revenue),
        cost: Math.round(v.cost),
        profit: Math.round(v.profit),
        margin: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 100 * 10) / 10 : 0,
        count: v.count,
      };
    });

    return {
      currentMonth: {
        totalRevenue: Math.round(totalRevenue),
        totalCost: Math.round(totalCost),
        totalProfit: Math.round(totalProfit),
        profitMargin,
        fileCount: currentMonthFiles.length,
      },
      byBranch,
      trend,
    };
  }
}
