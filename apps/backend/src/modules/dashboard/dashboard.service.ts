import { Injectable } from '@nestjs/common';
import { resolveClaimProfitAmount } from '@sigorta/shared';
import { canViewFileFinancials } from '@/common/helpers/financial-visibility.helper';
import { EmergencyStatus, EmergencyUrgency } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { CacheService } from '@/cache/cache.service';
import { OperationalAccessGrantsService } from '@/modules/operational-access-grants/operational-access-grants.service';
import {
  isOfficeStaffDashboardRole,
  normalizeDashboardRoleCode,
  pendingActionOwnerAliases,
} from './dashboard-role';
import {
  DASHBOARD_APPROVAL_DELAYS_TTL_SEC,
  DASHBOARD_CRITICAL_ALERTS_TTL_SEC,
  DASHBOARD_DAILY_FLOW_TTL_SEC,
  DASHBOARD_FINANCE_BOTTLENECKS_TTL_SEC,
  DASHBOARD_OWNERSHIP_LOAD_TTL_SEC,
  DASHBOARD_OPS_TTL_SEC,
  DASHBOARD_SLA_TTL_SEC,
} from '@/cache/cache.constants';

const APPROVAL_DELAY_WARNING_HOURS = 24;
const APPROVAL_DELAY_CRITICAL_HOURS = 48;

const PLAN_DEPT_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#7C3AED', '#EF4444', '#0891B2'];

function istanbulMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

/** Acil Yardım ekranındaki durum etiketleriyle birebir aynı (statusLabel, [id]/page.tsx) */
const EMERGENCY_PENDING_ACTION_LABEL: Partial<Record<EmergencyStatus, string>> = {
  GELEN: 'İhbar',
  ATANDI: 'Tedarikçi Atandı',
  SAHADA: 'Saha',
};

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private operationalAccessGrants: OperationalAccessGrantsService,
  ) {}

  /** office_staff scope: atanmış + vekalet kapsamındaki dosya sorumlusu dosyaları */
  private async buildDelegationScope(scopeUserId?: string) {
    if (!scopeUserId) {
      return { claim: {}, emergency: {} };
    }
    const [hasarPrincipalIds, acilPrincipalIds, hasAcilFunctionDelegation] = await Promise.all([
      this.operationalAccessGrants.getPrincipalUserIdsForGrantee(scopeUserId, 'hasar'),
      this.operationalAccessGrants.getPrincipalUserIdsForGrantee(scopeUserId, 'acil_yardim'),
      this.operationalAccessGrants.hasFunctionDelegation(scopeUserId, 'acil_yardim'),
    ]);
    return {
      claim: { assignedOfficeUserId: { in: [scopeUserId, ...hasarPrincipalIds] } },
      emergency: hasAcilFunctionDelegation
        ? {}
        : { assignedUserId: { in: [scopeUserId, ...acilPrincipalIds] } },
    };
  }

  private async scopedOfficeStaffWhere(scopeUserId?: string) {
    const scope = await this.buildDelegationScope(scopeUserId);
    return scope.claim;
  }

  private async scopedOpenClaimFileWhere(scopeUserId?: string) {
    const base = { currentStatus: { isClosedState: false } };
    if (!scopeUserId) return base;
    return { ...base, ...(await this.scopedOfficeStaffWhere(scopeUserId)) };
  }

  async getOperationsKpis(scopeUserId?: string) {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:operations',
      role: scopeUserId ? 'office_staff' : 'shared',
      userId: scopeUserId,
    });
    const cached = await this.cache.get<{
      totalClaims: number;
      openClaims: number;
      closedClaims: number;
      totalEmergencyCases: number;
      openEmergencyCases: number;
      closedEmergencyCases: number;
      totalOperationalFiles: number;
      openOperationalFiles: number;
      pendingTasks: number;
      slaViolationCount: number;
      overdueCollectionAmount: number;
    }>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();

    const delegationScope = await this.buildDelegationScope(scopeUserId);
    const scopeWhere = delegationScope.claim;
    const emergencyScopeWhere = delegationScope.emergency;
    const closedEmergencyStatuses: EmergencyStatus[] = [
      EmergencyStatus.COZULDU,
      EmergencyStatus.FATURALANDILDI,
    ];

    const [
      totalClaims,
      openClaims,
      closedClaims,
      totalEmergencyCases,
      openEmergencyCases,
      closedEmergencyCases,
      pendingTasks,
      slaViolationCount,
      overdueAgg,
    ] = await Promise.all([
        this.prisma.claimFile.count({ where: scopeWhere }),
        this.prisma.claimFile.count({
          where: { ...scopeWhere, currentStatus: { isClosedState: false } },
        }),
        this.prisma.claimFile.count({
          where: { ...scopeWhere, currentStatus: { isClosedState: true } },
        }),
        this.prisma.emergencyCase.count({ where: emergencyScopeWhere }),
        this.prisma.emergencyCase.count({
          where: { ...emergencyScopeWhere, status: { notIn: closedEmergencyStatuses } },
        }),
        this.prisma.emergencyCase.count({
          where: { ...emergencyScopeWhere, status: { in: closedEmergencyStatuses } },
        }),
        this.prisma.task.count({ where: { status: 'pending' } }),
        this.prisma.claimFile.count({
          where: {
            ...scopeWhere,
            currentStatus: { isClosedState: false },
            slaDueAt: { lt: now },
          },
        }),
        this.prisma.invoice.aggregate({
          where: { dueDate: { lt: now }, status: { notIn: ['paid', 'cancelled'] } },
          _sum: { totalAmount: true },
        }),
      ]);

    const result = {
      totalClaims,
      openClaims,
      closedClaims,
      totalEmergencyCases,
      openEmergencyCases,
      closedEmergencyCases,
      totalOperationalFiles: totalClaims + totalEmergencyCases,
      openOperationalFiles: openClaims + openEmergencyCases,
      pendingTasks,
      slaViolationCount,
      overdueCollectionAmount: overdueAgg._sum.totalAmount ?? 0,
    };
    this.cache.set(cacheKey, result, DASHBOARD_OPS_TTL_SEC).catch(() => {});
    return result;
  }

  async getUserPerformance(filters: DashboardFiltersDto, scopeUserId?: string) {
    const where = { ...this.buildWhereClause(filters), ...(await this.scopedOfficeStaffWhere(scopeUserId)) };
    const now = new Date();

    const claimFiles = await this.prisma.claimFile.findMany({
      where,
      include: {
        currentStatus: {
          select: { id: true, name: true, code: true, isClosedState: true },
        },
        assignedOfficeUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedFieldUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type UserStat = {
      userId: string;
      userName: string;
      userType: string;
      totalFiles: number;
      openFiles: number;
      closedFiles: number;
      slaViolations: number;
      totalCloseDays: number;
      closedFileCount: number;
      pendingFiles: Array<{
        fileNo: string;
        claimNo: string;
        status: string;
        daysPending: number;
        slaViolation: boolean;
      }>;
    };

    const userMap = new Map<string, UserStat>();

    const addFileToUser = (
      userId: string,
      userName: string,
      userType: string,
      file: (typeof claimFiles)[0],
    ) => {
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName,
          userType,
          totalFiles: 0,
          openFiles: 0,
          closedFiles: 0,
          slaViolations: 0,
          totalCloseDays: 0,
          closedFileCount: 0,
          pendingFiles: [],
        });
      }

      const stat = userMap.get(userId)!;
      stat.totalFiles++;

      if (file.currentStatus.isClosedState) {
        stat.closedFiles++;
        if (file.closedAt) {
          const days =
            (file.closedAt.getTime() - file.createdAt.getTime()) /
            (1000 * 60 * 60 * 24);
          stat.totalCloseDays += days;
          stat.closedFileCount++;
        }
      } else {
        stat.openFiles++;
        const isSlaViolation = !!(file.slaDueAt && file.slaDueAt < now);
        if (isSlaViolation) {
          stat.slaViolations++;
        }
        const daysPending = Math.floor(
          (now.getTime() - file.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        stat.pendingFiles.push({
          fileNo: file.fileNo,
          claimNo: file.claimNo,
          status: file.currentStatus.name,
          daysPending,
          slaViolation: isSlaViolation,
        });
      }
    };

    for (const file of claimFiles) {
      if (file.assignedOfficeUser) {
        addFileToUser(
          file.assignedOfficeUser.id,
          `${file.assignedOfficeUser.firstName} ${file.assignedOfficeUser.lastName}`,
          'Ofis',
          file,
        );
      }
      if (file.assignedFieldUser) {
        addFileToUser(
          file.assignedFieldUser.id,
          `${file.assignedFieldUser.firstName} ${file.assignedFieldUser.lastName}`,
          'Saha',
          file,
        );
      }
    }

    const users = Array.from(userMap.values())
      .map((stat) => ({
        userId: stat.userId,
        userName: stat.userName,
        userType: stat.userType,
        totalFiles: stat.totalFiles,
        openFiles: stat.openFiles,
        closedFiles: stat.closedFiles,
        slaViolations: stat.slaViolations,
        avgCloseDays:
          stat.closedFileCount > 0
            ? Math.round(stat.totalCloseDays / stat.closedFileCount)
            : 0,
        pendingFiles: stat.pendingFiles
          .sort((a, b) => b.daysPending - a.daysPending)
          .slice(0, 5),
      }))
      .sort((a, b) => b.totalFiles - a.totalFiles);

    const slaViolations = claimFiles
      .filter(
        (f) =>
          !f.currentStatus.isClosedState && f.slaDueAt && f.slaDueAt < now,
      )
      .map((f) => ({
        fileNo: f.fileNo,
        claimNo: f.claimNo,
        status: f.currentStatus.name,
        slaDueAt: f.slaDueAt,
        daysOverdue: Math.floor(
          (now.getTime() - f.slaDueAt!.getTime()) / (1000 * 60 * 60 * 24),
        ),
        officeUser: f.assignedOfficeUser
          ? `${f.assignedOfficeUser.firstName} ${f.assignedOfficeUser.lastName}`
          : null,
        fieldUser: f.assignedFieldUser
          ? `${f.assignedFieldUser.firstName} ${f.assignedFieldUser.lastName}`
          : null,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return { users, slaViolations };
  }

  async getMyPerformance(userId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const scopeWhere = { OR: [{ assignedOfficeUserId: userId }, { assignedFieldUserId: userId }] };

    // Temel dosya verisi
    const [totalFiles, openFiles, closedFiles, slaViolations, thisMonthClosed] = await Promise.all([
      this.prisma.claimFile.count({ where: scopeWhere }),
      this.prisma.claimFile.count({ where: { ...scopeWhere, currentStatus: { isClosedState: false } } }),
      this.prisma.claimFile.count({ where: { ...scopeWhere, currentStatus: { isClosedState: true } } }),
      this.prisma.claimFile.count({ where: { ...scopeWhere, currentStatus: { isClosedState: false }, slaDueAt: { lt: now } } }),
      this.prisma.claimFile.count({ where: { ...scopeWhere, currentStatus: { isClosedState: true }, closedAt: { gte: thisMonthStart } } }),
    ]);

    // Kapanma süresi hesabı
    const closedWithDates = await this.prisma.claimFile.findMany({
      where: { ...scopeWhere, currentStatus: { isClosedState: true }, closedAt: { not: null } },
      select: { createdAt: true, closedAt: true, slaDueAt: true },
    });

    let totalCloseDays = 0;
    let slaCompliantCount = 0;
    for (const f of closedWithDates) {
      const days = (f.closedAt!.getTime() - f.createdAt.getTime()) / 86400000;
      totalCloseDays += days;
      if (f.slaDueAt && f.closedAt! <= f.slaDueAt) slaCompliantCount++;
    }
    const avgCloseDays = closedWithDates.length > 0 ? Math.round(totalCloseDays / closedWithDates.length) : 0;
    const slaComplianceRate = closedWithDates.length > 0 ? Math.round((slaCompliantCount / closedWithDates.length) * 100) : 100;

    // Gecikme metrikleri (açık SLA ihlali dosyaları)
    const overdueFiles = await this.prisma.claimFile.findMany({
      where: { ...scopeWhere, currentStatus: { isClosedState: false }, slaDueAt: { lt: now } },
      select: { slaDueAt: true },
    });
    const avgDelayDays = overdueFiles.length > 0
      ? Math.round(overdueFiles.reduce((s, f) => s + (now.getTime() - f.slaDueAt!.getTime()) / 86400000, 0) / overdueFiles.length)
      : 0;
    const delayRate = totalFiles > 0 ? Math.round((slaViolations / totalFiles) * 100) : 0;

    // Rapor revizyon oranı (eksper raporları bu kullanıcıya atanmış dosyalar)
    const reports = await this.prisma.adjusterReport.findMany({
      where: { assignment: { claimFile: scopeWhere } },
      select: { status: true },
    });
    const totalReports = reports.length;
    const rejectedReports = reports.filter((r) => r.status === 'rejected').length;
    const revisionRate = totalReports > 0 ? Math.round((rejectedReports / totalReports) * 100) : 0;

    // Kapasite değerlendirmesi (açık dosya / makul kapasite — default 20)
    const capacity = 20;
    const capacityUsageRate = Math.min(Math.round((openFiles / capacity) * 100), 100);

    // Memnuniyet skoru (survey ortalama q1-q5 puan ortalaması)
    const surveyAvg = await this.prisma.surveyResponse.aggregate({
      where: { campaign: { claimFile: scopeWhere } },
      _avg: { q1Rating: true, q2Rating: true, q3Rating: true, q4Rating: true, q5Rating: true },
    });
    const avg = surveyAvg?._avg;
    const ratingVals = [avg?.q1Rating, avg?.q2Rating, avg?.q3Rating, avg?.q4Rating, avg?.q5Rating].filter((v): v is number => v != null);
    const satisfactionScore = ratingVals.length > 0
      ? Math.round((ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length) * 20) // 1-5 → 0-100
      : null;

    // Risk skoru hesaplama
    // Ağırlıklar: gecikme oranı 40%, revizyon oranı 30%, ortalama kapanma süresi 30%
    const avgCloseDaysScore = Math.min(Math.round((avgCloseDays / 30) * 100), 100); // 30 gün = 100%
    const riskScore = Math.round(
      delayRate * 0.4 +
      revisionRate * 0.3 +
      avgCloseDaysScore * 0.3
    );

    // Son 6 aylık trend
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const allClosed = await this.prisma.claimFile.findMany({
      where: { ...scopeWhere, currentStatus: { isClosedState: true }, closedAt: { gte: sixMonthsAgo } },
      select: { closedAt: true, slaDueAt: true, createdAt: true },
    });

    const trendMap = new Map<string, { closed: number; compliant: number; totalDays: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendMap.set(key, { closed: 0, compliant: 0, totalDays: 0 });
    }
    for (const f of allClosed) {
      const d = f.closedAt!;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (trendMap.has(key)) {
        const t = trendMap.get(key)!;
        t.closed++;
        if (f.slaDueAt && d <= f.slaDueAt) t.compliant++;
        t.totalDays += (d.getTime() - f.createdAt.getTime()) / 86400000;
      }
    }
    const trend = Array.from(trendMap.entries()).map(([month, t]) => ({
      month,
      closedFiles: t.closed,
      slaCompliance: t.closed > 0 ? Math.round((t.compliant / t.closed) * 100) : 100,
      avgCloseDays: t.closed > 0 ? Math.round(t.totalDays / t.closed) : 0,
    }));

    return {
      totalFiles,
      openFiles,
      closedFiles,
      thisMonthClosed,
      avgCloseDays,
      slaComplianceRate,
      capacityUsageRate,
      satisfactionScore,
      slaViolations,
      delayRate,
      avgDelayDays,
      revisionRate,
      riskScore,
      trend,
    };
  }

  async getAdjusterPerformance(_filters: DashboardFiltersDto) {
    const adjusters = await this.prisma.adjuster.findMany({
      where: { status: 'active' },
      include: {
        assignments: {
          include: { report: true },
        },
      },
    });

    const metrics = adjusters.map((adj) => {
      const total = adj.assignments.length;
      const completed = adj.assignments.filter((a) => a.status === 'completed').length;
      const pending = adj.assignments.filter((a) => a.status === 'pending').length;
      const accepted = adj.assignments.filter((a) => a.status === 'accepted').length;

      const reports = adj.assignments.filter((a) => a.report).map((a) => a.report!);
      const totalReports = reports.length;
      const rejectedReports = reports.filter((r) => r.status === 'rejected').length;
      const revisionRate = totalReports > 0 ? Math.round((rejectedReports / totalReports) * 100) : 0;

      const reportDays: number[] = [];
      for (const a of adj.assignments) {
        if (a.report?.reportDate) {
          const diff = (new Date(a.report.reportDate).getTime() - new Date(a.assignedAt).getTime()) / (1000 * 60 * 60 * 24);
          if (diff >= 0) reportDays.push(diff);
        }
      }
      const avgReportDays = reportDays.length > 0 ? Math.round(reportDays.reduce((s, d) => s + d, 0) / reportDays.length) : 0;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const revisionScore = Math.max(0, 100 - revisionRate);
      const speedScore = avgReportDays > 0 ? Math.max(0, 100 - avgReportDays * 2) : 100;
      const performanceScore = Math.round(speedScore * 0.4 + revisionScore * 0.3 + completionRate * 0.3);

      return {
        id: adj.id,
        name: adj.name,
        company: adj.company,
        city: adj.city,
        region: adj.region,
        total,
        completed,
        pending,
        accepted,
        totalReports,
        rejectedReports,
        revisionRate,
        avgReportDays,
        completionRate,
        performanceScore,
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    const totalAdjusters = metrics.length;
    const activeAssignments = metrics.reduce((s, m) => s + m.accepted + m.pending, 0);
    const avgReportDays = metrics.filter((m) => m.avgReportDays > 0).length > 0
      ? Math.round(metrics.filter((m) => m.avgReportDays > 0).reduce((s, m) => s + m.avgReportDays, 0) / metrics.filter((m) => m.avgReportDays > 0).length)
      : 0;
    const avgRevisionRate = metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.revisionRate, 0) / metrics.length) : 0;

    return {
      summary: { totalAdjusters, activeAssignments, avgReportDays, avgRevisionRate },
      adjusters: metrics,
    };
  }

  async getBudgetEfficiency(filters: DashboardFiltersDto) {
    const where = this.buildWhereClause(filters);

    const claimFiles = await this.prisma.claimFile.findMany({
      where,
      include: {
        insuranceCompany: { select: { id: true, name: true } },
        currentStatus: { select: { isClosedState: true } },
        assignedOfficeUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    let totalEstimated = 0;
    let totalActual = 0;
    let totalProfit = 0;

    type InsuranceStat = {
      id: string;
      name: string;
      totalEstimated: number;
      totalActual: number;
      count: number;
      profit: number;
    };
    type BranchStat = {
      branch: string;
      totalEstimated: number;
      totalActual: number;
      count: number;
      profit: number;
    };
    type UserBudgetStat = {
      userId: string;
      userName: string;
      totalEstimated: number;
      totalActual: number;
      count: number;
      profit: number;
    };
    type MonthlyStat = {
      month: string;
      estimated: number;
      actual: number;
      count: number;
    };

    const byInsurance = new Map<string, InsuranceStat>();
    const byBranch = new Map<string, BranchStat>();
    const byUser = new Map<string, UserBudgetStat>();
    const monthlyMap = new Map<string, MonthlyStat>();

    for (const file of claimFiles) {
      const est = file.estimatedCostAmount ?? 0;
      const actual = file.actualCostAmount ?? 0;
      const profit = resolveClaimProfitAmount({
        actualRevenue: file.invoicedAmount ?? 0,
        actualCost: actual,
        actualProfit: file.profitAmount ?? 0,
        planRevenue: file.approvedBudgetAmount ?? 0,
        planCost: est,
      });

      totalEstimated += est;
      totalActual += actual;
      totalProfit += profit;

      if (file.insuranceCompany) {
        const key = file.insuranceCompany.id;
        if (!byInsurance.has(key)) {
          byInsurance.set(key, {
            id: key,
            name: file.insuranceCompany.name,
            totalEstimated: 0,
            totalActual: 0,
            count: 0,
            profit: 0,
          });
        }
        const ins = byInsurance.get(key)!;
        ins.totalEstimated += est;
        ins.totalActual += actual;
        ins.profit += profit;
        ins.count++;
      }

      const branch = file.productBranch || 'Diğer';
      if (!byBranch.has(branch)) {
        byBranch.set(branch, {
          branch,
          totalEstimated: 0,
          totalActual: 0,
          count: 0,
          profit: 0,
        });
      }
      const br = byBranch.get(branch)!;
      br.totalEstimated += est;
      br.totalActual += actual;
      br.profit += profit;
      br.count++;

      if (file.assignedOfficeUser) {
        const key = file.assignedOfficeUser.id;
        if (!byUser.has(key)) {
          byUser.set(key, {
            userId: key,
            userName: `${file.assignedOfficeUser.firstName} ${file.assignedOfficeUser.lastName}`,
            totalEstimated: 0,
            totalActual: 0,
            count: 0,
            profit: 0,
          });
        }
        const u = byUser.get(key)!;
        u.totalEstimated += est;
        u.totalActual += actual;
        u.profit += profit;
        u.count++;
      }

      const monthKey = file.notificationDate.toISOString().substring(0, 7);
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          estimated: 0,
          actual: 0,
          count: 0,
        });
      }
      const mo = monthlyMap.get(monthKey)!;
      mo.estimated += est;
      mo.actual += actual;
      mo.count++;
    }

    type WithDeviation<T> = T & {
      deviationAmount: number;
      deviationRate: number;
    };

    const addDeviation = <T extends { totalEstimated: number; totalActual: number }>(
      arr: T[],
    ): WithDeviation<T>[] =>
      arr.map((item) => ({
        ...item,
        deviationAmount: item.totalActual - item.totalEstimated,
        deviationRate:
          item.totalEstimated > 0
            ? Math.round(
                ((item.totalActual - item.totalEstimated) /
                  item.totalEstimated) *
                  10000,
              ) / 100
            : 0,
      }));

    return {
      summary: {
        totalEstimated,
        totalActual,
        totalProfit,
        deviationAmount: totalActual - totalEstimated,
        deviationRate:
          totalEstimated > 0
            ? Math.round(
                ((totalActual - totalEstimated) / totalEstimated) * 10000,
              ) / 100
            : 0,
        fileCount: claimFiles.length,
      },
      byInsuranceCompany: addDeviation(Array.from(byInsurance.values())).sort(
        (a, b) => b.count - a.count,
      ),
      byBranch: addDeviation(Array.from(byBranch.values())).sort(
        (a, b) => b.count - a.count,
      ),
      byUser: addDeviation(Array.from(byUser.values())).sort(
        (a, b) => b.count - a.count,
      ),
      monthlyTrend: Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12),
    };
  }

  private buildWhereClause(filters: DashboardFiltersDto) {
    const where: Record<string, unknown> = {};

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
      if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
      where.notificationDate = dateFilter;
    }

    if (filters.insuranceCompanyId) {
      where.insuranceCompanyId = filters.insuranceCompanyId;
    }

    if (filters.productBranch) {
      where.productBranch = filters.productBranch;
    }

    if (filters.userId) {
      where.OR = [
        { assignedOfficeUserId: filters.userId },
        { assignedFieldUserId: filters.userId },
      ];
    }

    return where;
  }

  async getFinanceDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Overall totals from financial summaries
    const summaryAgg = await this.prisma.claimFinancialSummary.aggregate({
      _sum: {
        actualRevenue: true,
        actualCost: true,
        grossProfit: true,
      },
    });

    const totalRevenue = summaryAgg._sum.actualRevenue ?? 0;
    const totalCost = summaryAgg._sum.actualCost ?? 0;
    const totalProfit = summaryAgg._sum.grossProfit ?? 0;
    const avgMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Monthly trend (last 12 months) from invoices
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyInvoices = await this.prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: twelveMonthsAgo },
        status: { not: 'cancelled' },
      },
      select: { invoiceType: true, totalAmount: true, invoiceDate: true },
    });

    const monthlyMap = new Map<string, { revenue: number; cost: number }>();
    for (const inv of monthlyInvoices) {
      const key = inv.invoiceDate.toISOString().substring(0, 7);
      if (!monthlyMap.has(key)) monthlyMap.set(key, { revenue: 0, cost: 0 });
      const mo = monthlyMap.get(key)!;
      if (inv.invoiceType === 'sales') mo.revenue += inv.totalAmount;
      else mo.cost += inv.totalAmount;
    }

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, v]) => ({ month, revenue: v.revenue, cost: v.cost, profit: v.revenue - v.cost }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Overdue invoices
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { dueDate: { lt: today }, status: { notIn: ['paid', 'cancelled'] } },
      include: { claimFile: { select: { fileNo: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Insurance company collections
    const claimFilesForIns = await this.prisma.claimFile.findMany({
      include: {
        insuranceCompany: { select: { id: true, name: true } },
        financialSummary: true,
      },
    });

    const insMap = new Map<string, { name: string; revenue: number; collected: number; count: number }>();
    let filePlanRevenue = 0;
    let filePlanCost = 0;
    let filePlanProfit = 0;
    const monthlyPlanMap = new Map<string, { revenue: number; cost: number; profit: number }>();
    const deptMap = new Map<string, number>();

    for (const f of claimFilesForIns) {
      const planRev = f.approvedBudgetAmount ?? 0;
      const planCst = f.estimatedCostAmount ?? 0;
      const actualRev = f.invoicedAmount ?? f.financialSummary?.actualRevenue ?? 0;
      const actualCst = f.actualCostAmount ?? f.financialSummary?.actualCost ?? 0;
      const profit = resolveClaimProfitAmount({
        actualRevenue: actualRev,
        actualCost: actualCst,
        actualProfit: f.profitAmount ?? 0,
        planRevenue: planRev,
        planCost: planCst,
      });
      const hasActuals = actualRev > 0 || actualCst > 0;
      const displayRev = hasActuals ? actualRev : planRev;
      const displayCost = hasActuals ? actualCst : planCst;
      filePlanRevenue += displayRev;
      filePlanCost += displayCost;
      filePlanProfit += profit;

      const monthKey = istanbulMonthKey(f.notificationDate);
      if (!monthlyPlanMap.has(monthKey)) {
        monthlyPlanMap.set(monthKey, { revenue: 0, cost: 0, profit: 0 });
      }
      const planMo = monthlyPlanMap.get(monthKey)!;
      planMo.revenue += displayRev;
      planMo.cost += displayCost;
      planMo.profit += profit;

      const branch = (f.productBranch || 'Diğer').trim() || 'Diğer';
      deptMap.set(branch, (deptMap.get(branch) ?? 0) + displayRev);

      if (!f.insuranceCompany) continue;
      const key = f.insuranceCompany.id;
      if (!insMap.has(key)) insMap.set(key, { name: f.insuranceCompany.name, revenue: 0, collected: 0, count: 0 });
      const ins = insMap.get(key)!;
      ins.revenue += actualRev > 0 ? actualRev : planRev;
      ins.collected += f.collectedAmount ?? 0;
      ins.count++;
    }
    const insuranceCollections = Array.from(insMap.values())
      .map((v) => ({ ...v, collectionRate: v.revenue > 0 ? (v.collected / v.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
    const monthlyPlanTrend = Array.from(monthlyPlanMap.entries())
      .map(([month, v]) => ({
        month,
        revenue: v.revenue,
        cost: v.cost,
        profit: v.profit,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const departmentSlices = Array.from(deptMap.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: PLAN_DEPT_COLORS[i % PLAN_DEPT_COLORS.length],
      }));
    const filePlanSummary = {
      totalRevenue: filePlanRevenue,
      totalCost: filePlanCost,
      totalProfit: filePlanProfit,
      avgMarginPct: filePlanRevenue > 0 ? (filePlanProfit / filePlanRevenue) * 100 : 0,
    };

    // Top 10 profitable files
    const topProfitable = await this.prisma.claimFinancialSummary.findMany({
      orderBy: { grossProfit: 'desc' },
      take: 10,
      include: { claimFile: { select: { fileNo: true, insuranceCompanyId: true } } },
    });

    // Top 10 loss-making files
    const topLoss = await this.prisma.claimFinancialSummary.findMany({
      orderBy: { grossProfit: 'asc' },
      take: 10,
      include: { claimFile: { select: { fileNo: true, insuranceCompanyId: true } } },
    });

    return {
      summary: { totalRevenue, totalCost, totalProfit, avgMarginPct },
      filePlanSummary,
      monthlyTrend,
      monthlyPlanTrend,
      departmentSlices,
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        fileNo: inv.claimFile.fileNo,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        status: inv.status,
        daysOverdue: Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      insuranceCollections,
      topProfitableFiles: topProfitable.map((s) => ({
        claimFileId: s.claimFileId,
        fileNo: s.claimFile.fileNo,
        actualRevenue: s.actualRevenue,
        actualCost: s.actualCost,
        grossProfit: s.grossProfit,
        grossMarginPct: s.grossMarginPct,
      })),
      topLossFiles: topLoss.filter((s) => s.grossProfit < 0).map((s) => ({
        claimFileId: s.claimFileId,
        fileNo: s.claimFile.fileNo,
        actualRevenue: s.actualRevenue,
        actualCost: s.actualCost,
        grossProfit: s.grossProfit,
        grossMarginPct: s.grossMarginPct,
      })),
    };
  }

  async getProfitabilityReport(
    filters: { dateFrom?: string; dateTo?: string; insuranceCompanyId?: string; groupBy?: string },
    user?: { id: string; roleCode?: string },
  ) {
    const groupBy = filters.groupBy ?? 'file';
    const where: any = {};
    if (filters.insuranceCompanyId) where.claimFile = { insuranceCompanyId: filters.insuranceCompanyId };

    const summaries = await this.prisma.claimFinancialSummary.findMany({
      where,
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            hideFinancialFromAssignees: true,
            financialVisibilityConfig: true,
            assignedFieldUserId: true,
            assignedOfficeUserId: true,
            currentResponsibleUserId: true,
            insuranceCompany: { select: { name: true } },
            assignedAdjuster: { select: { firstName: true, lastName: true } },
            closedAt: true,
            notificationDate: true,
          },
        },
      },
      orderBy: { grossProfit: 'desc' },
    });

    const visibleSummaries = user
      ? (summaries as any[]).filter((s) => canViewFileFinancials(user, s.claimFile))
      : (summaries as any[]);

    if (groupBy === 'expert') {
      // Group by expert
      const expertMap = new Map<string, { name: string; revenue: number; cost: number; profit: number; margin: number; count: number }>();
      for (const s of visibleSummaries) {
        const fn = s.claimFile?.assignedAdjuster?.firstName ?? '';
        const ln = s.claimFile?.assignedAdjuster?.lastName ?? '';
        const key = `${fn} ${ln}`.trim() || 'Atanmamış';
        const existing = expertMap.get(key) ?? { name: key, revenue: 0, cost: 0, profit: 0, margin: 0, count: 0 };
        existing.revenue += s.actualRevenue ?? 0;
        existing.cost += s.actualCost ?? 0;
        existing.profit += s.grossProfit ?? 0;
        existing.count += 1;
        expertMap.set(key, existing);
      }
      return Array.from(expertMap.values()).map((e) => ({
        expertName: e.name,
        actualRevenue: e.revenue,
        actualCost: e.cost,
        grossProfit: e.profit,
        grossMarginPct: e.revenue > 0 ? (e.profit / e.revenue) * 100 : 0,
        fileCount: e.count,
      }));
    }

    if (groupBy === 'company') {
      // Group by insurance company
      const companyMap = new Map<string, { name: string; revenue: number; cost: number; profit: number; count: number }>();
      for (const s of visibleSummaries) {
        const key = s.claimFile?.insuranceCompany?.name ?? 'Bilinmeyen';
        const existing = companyMap.get(key) ?? { name: key, revenue: 0, cost: 0, profit: 0, count: 0 };
        existing.revenue += s.actualRevenue ?? 0;
        existing.cost += s.actualCost ?? 0;
        existing.profit += s.grossProfit ?? 0;
        existing.count += 1;
        companyMap.set(key, existing);
      }
      return Array.from(companyMap.values()).map((c) => ({
        insuranceCompany: c.name,
        actualRevenue: c.revenue,
        actualCost: c.cost,
        grossProfit: c.profit,
        grossMarginPct: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        fileCount: c.count,
      }));
    }

    // Default: file
    return visibleSummaries.map((s) => ({
      claimFileId: s.claimFileId,
      fileNo: s.claimFile?.fileNo,
      insuranceCompany: s.claimFile?.insuranceCompany?.name ?? '—',
      estimatedRevenue: s.estimatedRevenue,
      actualRevenue: s.actualRevenue,
      estimatedCost: s.estimatedCost,
      actualCost: s.actualCost,
      grossProfit: s.grossProfit,
      grossMarginPct: s.grossMarginPct,
      lastCalculatedAt: s.lastCalculatedAt,
    }));
  }

  async getCollectionsReport(filters: { dateFrom?: string; dateTo?: string }) {
    const where: any = { paymentType: 'incoming' };
    if (filters.dateFrom || filters.dateTo) {
      where.paymentDate = {};
      if (filters.dateFrom) where.paymentDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.paymentDate.lte = new Date(filters.dateTo);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        claimFile: { select: { fileNo: true, insuranceCompanyId: true } },
        invoice: { select: { invoiceNo: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const totalCollected = payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    const overdueCount = await this.prisma.invoice.count({
      where: { dueDate: { lt: new Date() }, status: { notIn: ['paid', 'cancelled'] } },
    });

    return { totalCollected, overdueCount, payments };
  }

  // ── Dosya Performans Raporu ───────────────────────────────────────────────

  async getFilePerformanceReport(filters: DashboardFiltersDto) {
    const where = this.buildWhereClause(filters);

    const files = await this.prisma.claimFile.findMany({
      where,
      include: {
        currentStatus: { select: { name: true, isClosedState: true } },
        insuranceCompany: { select: { id: true, name: true } },
        assignedBranch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Close duration analysis
    const closedFiles = files.filter((f) => f.currentStatus.isClosedState && f.closedAt);
    const closeDays = closedFiles.map((f) =>
      Math.round((f.closedAt!.getTime() - f.createdAt.getTime()) / 86400000),
    );

    const avg = closeDays.length
      ? Math.round(closeDays.reduce((s, d) => s + d, 0) / closeDays.length)
      : 0;
    const sorted = [...closeDays].sort((a, b) => a - b);
    const median = sorted.length
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const min = sorted.length ? sorted[0] : 0;
    const max = sorted.length ? sorted[sorted.length - 1] : 0;

    // By branch
    const branchMap = new Map<string, { name: string; count: number; closedCount: number; totalDays: number }>();
    for (const f of files) {
      const key = f.assignedBranch?.id ?? 'other';
      const name = f.assignedBranch?.name ?? 'Diğer';
      if (!branchMap.has(key)) branchMap.set(key, { name, count: 0, closedCount: 0, totalDays: 0 });
      const b = branchMap.get(key)!;
      b.count++;
      if (f.currentStatus.isClosedState && f.closedAt) {
        b.closedCount++;
        b.totalDays += Math.round((f.closedAt.getTime() - f.createdAt.getTime()) / 86400000);
      }
    }

    // By insurance company - status distribution
    const insMap = new Map<
      string,
      { name: string; total: number; open: number; closed: number }
    >();
    for (const f of files) {
      if (!f.insuranceCompany) continue;
      const key = f.insuranceCompany.id;
      if (!insMap.has(key))
        insMap.set(key, { name: f.insuranceCompany.name, total: 0, open: 0, closed: 0 });
      const ins = insMap.get(key)!;
      ins.total++;
      if (f.currentStatus.isClosedState) ins.closed++;
      else ins.open++;
    }

    // Monthly trend (last 12 months)
    const monthlyMap = new Map<string, { opened: number; closed: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthlyMap.set(d.toISOString().substring(0, 7), { opened: 0, closed: 0 });
    }
    for (const f of files) {
      const openKey = f.createdAt.toISOString().substring(0, 7);
      if (monthlyMap.has(openKey)) monthlyMap.get(openKey)!.opened++;
      if (f.closedAt) {
        const closeKey = f.closedAt.toISOString().substring(0, 7);
        if (monthlyMap.has(closeKey)) monthlyMap.get(closeKey)!.closed++;
      }
    }

    return {
      summary: {
        totalFiles: files.length,
        openFiles: files.filter((f) => !f.currentStatus.isClosedState).length,
        closedFiles: closedFiles.length,
        avgCloseDays: avg,
        medianCloseDays: median,
        minCloseDays: min,
        maxCloseDays: max,
      },
      byBranch: Array.from(branchMap.values()).map((b) => ({
        ...b,
        avgCloseDays: b.closedCount > 0 ? Math.round(b.totalDays / b.closedCount) : 0,
      })),
      byInsuranceCompany: Array.from(insMap.values()).sort((a, b) => b.total - a.total),
      monthlyTrend: Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v })),
    };
  }

  // ── Personel Performans Raporu ────────────────────────────────────────────

  async getStaffPerformanceReport(filters: DashboardFiltersDto) {
    // Office/Field staff from getUserPerformance
    const { users: staffUsers } = await this.getUserPerformance(filters);

    // Vendor stats from BudgetItem
    const vendors = await this.prisma.vendor.findMany({
      include: {
        budgetItems: {
          include: { budgetVersion: { include: { claimFile: { select: { id: true } } } } },
        },
      },
    });

    const vendorStats = vendors.map((v) => {
      const assignmentCount = v.budgetItems.length;
      const completedCount = v.budgetItems.filter((bi) => bi.budgetVersion.status === 'approved').length;
      const completionRate =
        assignmentCount > 0 ? Math.round((completedCount / assignmentCount) * 100) : 0;
      return {
        vendorId: v.id,
        vendorName: v.name,
        assignmentCount,
        completedCount,
        completionRate,
      };
    });

    return { staffUsers, vendorStats };
  }

  // ── Finansal Genişletilmiş Rapor ──────────────────────────────────────────

  async getFinancialExtendedReport(filters: DashboardFiltersDto) {
    const [financeData, budgetData] = await Promise.all([
      this.getFinanceDashboard(),
      this.getBudgetEfficiency(filters),
    ]);

    // Vendor spending breakdown from CostEntry
    const costEntries = await this.prisma.costEntry.findMany({
      include: { vendor: { select: { id: true, name: true } } },
    });

    const vendorSpendMap = new Map<string, { name: string; amount: number; count: number }>();
    for (const ce of costEntries) {
      if (!ce.vendor) continue;
      const key = ce.vendor.id;
      if (!vendorSpendMap.has(key))
        vendorSpendMap.set(key, { name: ce.vendor.name, amount: 0, count: 0 });
      const vs = vendorSpendMap.get(key)!;
      vs.amount += ce.amount;
      vs.count++;
    }

    return {
      summary: financeData.summary,
      monthlyTrend: financeData.monthlyTrend,
      overdueInvoices: financeData.overdueInvoices,
      insuranceCollections: financeData.insuranceCollections,
      topProfitableFiles: financeData.topProfitableFiles,
      topLossFiles: financeData.topLossFiles,
      budgetDeviation: budgetData.summary,
      byInsuranceCompanyBudget: budgetData.byInsuranceCompany,
      vendorSpending: Array.from(vendorSpendMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20),
    };
  }

  // ── Eksper Genişletilmiş Performans Raporu ────────────────────────────────

  async getAdjusterExtendedReport(filters: DashboardFiltersDto) {
    const base = await this.getAdjusterPerformance(filters);

    return {
      summary: base.summary,
      adjusters: base.adjusters.map((a, idx) => ({
        ...a,
        rank: idx + 1,
        workloadBreakdown: {
          pending: a.pending,
          accepted: a.accepted,
          completed: a.completed,
          total: a.total,
        },
      })),
    };
  }

  // ── Sprint 3: Operasyon Hiyerarşisi ──────────────────────────────────────

  async getCriticalAlerts(scopeUserId?: string) {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:critical-alerts',
      role: scopeUserId ? 'office_staff' : 'shared',
      userId: scopeUserId,
    });
    const cached = await this.cache.get<{
      slaEscalations: Array<{
        id: string;
        fileNo: string;
        currentStatus: string | null;
        slaPercentage: number;
        assignedTo: string | null;
      }>;
      inactiveFiles: Array<{
        id: string;
        fileNo: string;
        lastActivityAt: Date | null;
        daysSinceActivity: number | null;
        currentStatus: string | undefined;
      }>;
      totalCritical: number;
    }>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const openFiles = await this.prisma.claimFile.findMany({
      where: await this.scopedOpenClaimFileWhere(scopeUserId),
      include: {
        currentStatus: true,
        currentResponsibleUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const slaEscalations = openFiles
      .filter((f) => {
        const maxHours = (f.currentStatus as any)?.maxDurationHours;
        if (!maxHours || !f.statusChangedAt) return false;
        const hoursInStatus = (now.getTime() - new Date(f.statusChangedAt).getTime()) / (1000 * 60 * 60);
        return hoursInStatus > maxHours;
      })
      .map((f) => {
        const maxHours = (f.currentStatus as any)?.maxDurationHours || 1;
        const hoursInStatus = (now.getTime() - new Date(f.statusChangedAt!).getTime()) / (1000 * 60 * 60);
        return {
          id: f.id, fileNo: f.fileNo,
          currentStatus: (f.currentStatus as any)?.name,
          slaPercentage: Math.round((hoursInStatus / maxHours) * 100),
          assignedTo: f.currentResponsibleUser
            ? `${f.currentResponsibleUser.firstName ?? ''} ${f.currentResponsibleUser.lastName ?? ''}`.trim()
            : null,
        };
      });

    const inactiveFiles = await this.prisma.claimFile.findMany({
      where: {
        ...(await this.scopedOpenClaimFileWhere(scopeUserId)),
        lastActivityAt: { lt: fortyEightHoursAgo },
      },
      select: { id: true, fileNo: true, lastActivityAt: true, currentStatus: { select: { name: true } } },
      take: 20,
    });

    const result = {
      slaEscalations,
      inactiveFiles: inactiveFiles.map((f) => ({
        id: f.id, fileNo: f.fileNo, lastActivityAt: f.lastActivityAt,
        daysSinceActivity: f.lastActivityAt ? Math.round((now.getTime() - new Date(f.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)) : null,
        currentStatus: f.currentStatus?.name,
      })),
      totalCritical: slaEscalations.length + inactiveFiles.length,
    };
    this.cache.set(cacheKey, result, DASHBOARD_CRITICAL_ALERTS_TTL_SEC).catch(() => {});
    return result;
  }

  async getApprovalDelays(scopeUserId?: string) {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:approval-delays',
      role: scopeUserId ? 'office_staff' : 'shared',
      userId: scopeUserId,
    });
    const cached = await this.cache.get<{
      items: Array<{
        id: string;
        fileNo: string;
        reportId: string;
        reportNo: string;
        status: string;
        category: 'pending_approval' | 'external_approval' | 'submitted';
        waitingSince: Date;
        hoursWaiting: number;
        severity: 'warning' | 'critical';
      }>;
      summary: {
        pendingApproval: number;
        externalApproval: number;
        submitted: number;
        warning: number;
        critical: number;
        total: number;
      };
    }>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const claimFileScope = scopeUserId
      ? { ...(await this.scopedOfficeStaffWhere(scopeUserId)), currentStatus: { isClosedState: false } }
      : { currentStatus: { isClosedState: false } };

    const reports = await this.prisma.repairReport.findMany({
      where: {
        status: { in: ['pending_approval', 'sent_for_external_approval', 'submitted'] },
        claimFile: claimFileScope,
      },
      select: {
        id: true,
        reportNo: true,
        status: true,
        updatedAt: true,
        claimFileId: true,
        claimFile: { select: { id: true, fileNo: true } },
        approvalHistory: {
          where: { action: { in: ['pending_approval', 'sent_for_external_approval'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, action: true },
        },
        externalApprovals: {
          where: { status: 'pending' },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    type DelayItem = {
      id: string;
      fileNo: string;
      reportId: string;
      reportNo: string;
      status: string;
      category: 'pending_approval' | 'external_approval' | 'submitted';
      waitingSince: Date;
      hoursWaiting: number;
      severity: 'warning' | 'critical';
    };

    const byClaimFile = new Map<string, DelayItem>();

    for (const report of reports) {
      let waitingSince: Date;
      let category: DelayItem['category'];

      if (report.status === 'pending_approval') {
        const hist = report.approvalHistory.find((h) => h.action === 'pending_approval');
        waitingSince = hist?.createdAt ?? report.updatedAt;
        category = 'pending_approval';
      } else if (report.status === 'sent_for_external_approval') {
        const ext = report.externalApprovals[0];
        const hist = report.approvalHistory.find((h) => h.action === 'sent_for_external_approval');
        waitingSince = ext?.sentAt ?? hist?.createdAt ?? report.updatedAt;
        category = 'external_approval';
      } else if (report.status === 'submitted') {
        waitingSince = report.updatedAt;
        category = 'submitted';
      } else {
        continue;
      }

      const hoursWaiting = (now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60);
      if (hoursWaiting < APPROVAL_DELAY_WARNING_HOURS) continue;

      const item: DelayItem = {
        id: report.claimFile.id,
        fileNo: report.claimFile.fileNo,
        reportId: report.id,
        reportNo: report.reportNo,
        status: report.status,
        category,
        waitingSince,
        hoursWaiting: Math.round(hoursWaiting),
        severity: hoursWaiting >= APPROVAL_DELAY_CRITICAL_HOURS ? 'critical' : 'warning',
      };

      const existing = byClaimFile.get(report.claimFileId);
      if (!existing || item.hoursWaiting > existing.hoursWaiting) {
        byClaimFile.set(report.claimFileId, item);
      }
    }

    const all = Array.from(byClaimFile.values()).sort((a, b) => b.hoursWaiting - a.hoursWaiting);
    const result = {
      items: all.slice(0, 20),
      summary: {
        pendingApproval: all.filter((i) => i.category === 'pending_approval').length,
        externalApproval: all.filter((i) => i.category === 'external_approval').length,
        submitted: all.filter((i) => i.category === 'submitted').length,
        warning: all.filter((i) => i.severity === 'warning').length,
        critical: all.filter((i) => i.severity === 'critical').length,
        total: all.length,
      },
    };
    this.cache.set(cacheKey, result, DASHBOARD_APPROVAL_DELAYS_TTL_SEC).catch(() => {});
    return result;
  }

  async getPendingActions(user: any) {
    const userId = user?.id;
    if (!userId) return { items: [], total: 0 };

    const roleCode = normalizeDashboardRoleCode(user);
    const isOfficeStaff = isOfficeStaffDashboardRole(roleCode);
    const ownerAliases = pendingActionOwnerAliases(roleCode);

    const where: Record<string, unknown> = {
      currentStatus: { isClosedState: false },
      OR: [
        { currentResponsibleUserId: userId },
        { pendingActionOwner: { in: ownerAliases } },
      ],
    };
    if (isOfficeStaff) {
      Object.assign(where, await this.scopedOfficeStaffWhere(userId));
    }

    const closedEmergencyStatuses: EmergencyStatus[] = [
      EmergencyStatus.COZULDU,
      EmergencyStatus.FATURALANDILDI,
    ];
    const emergencyScopeWhere = isOfficeStaff
      ? (await this.buildDelegationScope(userId)).emergency
      : (await this.operationalAccessGrants.hasFunctionDelegation(userId, 'acil_yardim'))
        ? {}
        : { assignedUserId: userId };

    const [files, emergencyCases] = await Promise.all([
      this.prisma.claimFile.findMany({
        where,
        select: { id: true, fileNo: true, priority: true, updatedAt: true, currentStatus: { select: { name: true } } },
        orderBy: { updatedAt: 'asc' },
        take: 30,
      }),
      this.prisma.emergencyCase.findMany({
        where: { ...emergencyScopeWhere, status: { notIn: closedEmergencyStatuses } },
        select: { id: true, fileNo: true, caseNo: true, status: true, urgency: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
        take: 30,
      }),
    ]);

    return {
      items: [
        ...files.map((f) => ({
          id: f.id,
          fileNo: f.fileNo,
          action: f.currentStatus?.name ?? 'Bekliyor',
          pendingSince: f.updatedAt,
          priority: f.priority,
          module: 'hasar' as const,
        })),
        ...emergencyCases.map((c) => ({
          id: c.id,
          fileNo: c.fileNo ?? c.caseNo,
          action: EMERGENCY_PENDING_ACTION_LABEL[c.status] ?? 'Bekliyor',
          pendingSince: c.updatedAt,
          priority:
            c.urgency === EmergencyUrgency.KRITIK
              ? ('critical' as const)
              : c.urgency === EmergencyUrgency.YUKSEK
                ? ('high' as const)
                : undefined,
          module: 'acil' as const,
        })),
      ],
      total: files.length + emergencyCases.length,
    };
  }

  async getSlaSummary(scopeUserId?: string) {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:sla-summary',
      role: scopeUserId ? 'office_staff' : 'shared',
      userId: scopeUserId,
    });
    const cached = await this.cache.get<{
      byStatus: Array<{ statusName: string; statusCode: string; total: number; normal: number; warning: number; critical: number; escalated: number }>;
      overall: { total: number; healthy: number; atRisk: number; critical: number };
    }>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const openFiles = await this.prisma.claimFile.findMany({
      where: await this.scopedOpenClaimFileWhere(scopeUserId),
      include: { currentStatus: true },
    });

    const statusMap = new Map<string, { name: string; code: string; normal: number; warning: number; critical: number; escalated: number }>();

    for (const f of openFiles) {
      const status = f.currentStatus as any;
      if (!status) continue;
      const key = status.id;
      if (!statusMap.has(key)) statusMap.set(key, { name: status.name, code: status.code ?? '', normal: 0, warning: 0, critical: 0, escalated: 0 });
      const entry = statusMap.get(key)!;
      const maxHours = status.maxDurationHours;
      if (!maxHours || !f.statusChangedAt) { entry.normal++; continue; }
      const pct = ((now.getTime() - new Date(f.statusChangedAt).getTime()) / (1000 * 60 * 60)) / maxHours * 100;
      if (pct > 100) entry.escalated++;
      else if (pct > 90) entry.critical++;
      else if (pct > 70) entry.warning++;
      else entry.normal++;
    }

    const byStatus = Array.from(statusMap.values()).map((s) => ({
      statusName: s.name, statusCode: s.code, total: s.normal + s.warning + s.critical + s.escalated,
      normal: s.normal, warning: s.warning, critical: s.critical, escalated: s.escalated,
    }));

    const overall = byStatus.reduce((acc, s) => ({
      total: acc.total + s.total, healthy: acc.healthy + s.normal,
      atRisk: acc.atRisk + s.warning, critical: acc.critical + s.critical + s.escalated,
    }), { total: 0, healthy: 0, atRisk: 0, critical: 0 });

    const result = { byStatus, overall };
    this.cache.set(cacheKey, result, DASHBOARD_SLA_TTL_SEC).catch(() => {});
    return result;
  }

  async getOwnershipLoad() {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:ownership-load',
      role: 'shared',
    });
    const cached = await this.cache.get<{
      items: Array<{
        userId: string;
        userName: string;
        role: string;
        activeFiles: number;
        criticalFiles: number;
        avgDaysPerFile: number;
      }>;
    }>(cacheKey);
    if (cached !== null) return cached;

    const files = await this.prisma.claimFile.findMany({
      where: { currentStatus: { isClosedState: false } },
      select: {
        id: true, statusChangedAt: true,
        currentResponsibleUser: { select: { id: true, firstName: true, lastName: true } },
        currentResponsibleRole: true,
        currentStatus: { select: { maxDurationHours: true } },
      },
    });

    const now = new Date();
    const userMap = new Map<string, { name: string; role: string; activeFiles: number; criticalFiles: number; totalDays: number }>();

    for (const f of files) {
      const u = f.currentResponsibleUser;
      if (!u) continue;
      if (!userMap.has(u.id)) userMap.set(u.id, { name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), role: f.currentResponsibleRole ?? '', activeFiles: 0, criticalFiles: 0, totalDays: 0 });
      const entry = userMap.get(u.id)!;
      entry.activeFiles++;
      const days = f.statusChangedAt ? (now.getTime() - new Date(f.statusChangedAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
      entry.totalDays += days;
      const maxH = (f.currentStatus as any)?.maxDurationHours;
      if (maxH && f.statusChangedAt) {
        const pct = ((now.getTime() - new Date(f.statusChangedAt).getTime()) / (1000 * 60 * 60)) / maxH * 100;
        if (pct > 90) entry.criticalFiles++;
      }
    }

    const result = {
      items: Array.from(userMap.entries()).map(([userId, d]) => ({
        userId, userName: d.name, role: d.role, activeFiles: d.activeFiles, criticalFiles: d.criticalFiles,
        avgDaysPerFile: d.activeFiles > 0 ? Math.round(d.totalDays / d.activeFiles) : 0,
      })).sort((a, b) => b.activeFiles - a.activeFiles),
    };
    this.cache.set(cacheKey, result, DASHBOARD_OWNERSHIP_LOAD_TTL_SEC).catch(() => {});
    return result;
  }

  async getFinanceBottlenecks() {
    const cacheKey = this.cache.buildKey({
      resource: 'dashboard:finance-bottlenecks',
      role: 'shared',
    });
    const cached = await this.cache.get<{
      pendingPayments: Array<{
        id: string;
        fileNo: string;
        amount: number;
        daysPending: number;
        insuranceCompany: string | null;
      }>;
      totalPendingAmount: number;
      overdueInvoices: number;
    }>(cacheKey);
    if (cached !== null) return cached;

    const paymentFiles = await this.prisma.claimFile.findMany({
      where: { currentStatus: { code: { in: ['payment_pending', 'finance_pending'] } } },
      select: { id: true, fileNo: true, updatedAt: true, invoicedAmount: true, actualCostAmount: true, insuranceCompany: { select: { name: true } } },
      orderBy: { updatedAt: 'asc' },
      take: 20,
    });

    const now = new Date();
    const pendingPayments = paymentFiles.map((f) => ({
      id: f.id, fileNo: f.fileNo,
      amount: (f as any).invoicedAmount ?? (f as any).actualCostAmount ?? 0,
      daysPending: Math.round((now.getTime() - new Date(f.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
      insuranceCompany: f.insuranceCompany?.name ?? null,
    }));

    let overdueInvoices = 0;
    try { overdueInvoices = await this.prisma.invoice.count({ where: { status: 'overdue' } }); } catch {}

    const result = {
      pendingPayments,
      totalPendingAmount: pendingPayments.reduce((s, p) => s + (p.amount || 0), 0),
      overdueInvoices,
    };
    this.cache.set(cacheKey, result, DASHBOARD_FINANCE_BOTTLENECKS_TTL_SEC).catch(() => {});
    return result;
  }

  async getActivityFeed(take: number = 20) {
    const history = await this.prisma.claimStatusHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take,
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        toStatus: { select: { name: true } },
        changedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      items: history.map((h) => ({
        id: h.id,
        claimFileId: h.claimFileId ?? (h as any).claimFile?.id ?? null,
        fileNo: (h as any).claimFile?.fileNo ?? null,
        action: 'status_change',
        description: `${(h as any).toStatus?.name ?? 'Bilinmeyen'} aşamasına geçirildi`,
        userId: (h as any).changedByUser?.id ?? null,
        userName: (h as any).changedByUser ? `${(h as any).changedByUser.firstName ?? ''} ${(h as any).changedByUser.lastName ?? ''}`.trim() : 'Sistem',
        createdAt: h.changedAt,
      })),
    };
  }

  /**
   * Admin A3/A4: bugünkü akış metrikleri + Pzt–Paz ekip yoğunluğu + geçen hafta özeti.
   * Yoğunluk = status history hareket sayısı (gün bazlı, limit yok).
   */
  async getDailyFlow() {
    const cacheKey = this.cache.buildKey({ resource: 'dashboard:daily-flow', role: 'shared' });
    type DailyFlowResult = {
      today: {
        newClaims: number;
        newEmergencies: number;
        plannedOperations: number;
        completedOperations: number;
      };
      teamDensity: Array<{ dayIndex: number; label: string; count: number }>;
      lastWeek: {
        closedClaims: number;
        collectionAmount: number;
        avgCloseDays: number | null;
        slaCompliancePct: number | null;
        rangeStart: string;
        rangeEnd: string;
      };
    };
    const cached = await this.cache.get<DailyFlowResult>(cacheKey);
    if (cached !== null) return cached;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // ISO hafta: pazartesi = 0
    const dayOfWeek = (todayStart.getDay() + 6) % 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);

    const lastWeekEnd = new Date(weekStart);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const closedEmergencyStatuses: EmergencyStatus[] = [
      EmergencyStatus.COZULDU,
      EmergencyStatus.FATURALANDILDI,
    ];

    const [
      newClaims,
      newEmergencies,
      plannedFileAppts,
      plannedAppts,
      plannedTasks,
      completedClaims,
      completedEmergencies,
      completedTasks,
      dayCounts,
      lastWeekClosed,
      lastWeekClosedRows,
      lastWeekCollections,
    ] = await Promise.all([
      this.prisma.claimFile.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.emergencyCase.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.fileAppointment.count({
        where: {
          scheduledDate: { gte: todayStart, lt: tomorrowStart },
          status: { notIn: ['cancelled', 'completed', 'done'] },
        },
      }),
      this.prisma.appointment.count({
        where: {
          scheduledAt: { gte: todayStart, lt: tomorrowStart },
          status: { notIn: ['cancelled', 'completed', 'done'] },
        },
      }),
      this.prisma.task.count({
        where: {
          status: 'pending',
          OR: [
            { dueAt: { gte: todayStart, lt: tomorrowStart } },
            { dueAt: null, createdAt: { gte: todayStart, lt: tomorrowStart } },
          ],
        },
      }),
      this.prisma.claimFile.count({
        where: { closedAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.emergencyCase.count({
        where: {
          status: { in: closedEmergencyStatuses },
          OR: [
            { resolvedAt: { gte: todayStart, lt: tomorrowStart } },
            { resolvedAt: null, updatedAt: { gte: todayStart, lt: tomorrowStart } },
          ],
        },
      }),
      this.prisma.task.count({
        where: { completedAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const dayStart = new Date(weekStart);
          dayStart.setDate(dayStart.getDate() + i);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          return this.prisma.claimStatusHistory.count({
            where: { changedAt: { gte: dayStart, lt: dayEnd } },
          });
        }),
      ),
      this.prisma.claimFile.count({
        where: { closedAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      }),
      this.prisma.claimFile.findMany({
        where: { closedAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        select: { createdAt: true, closedAt: true, slaDueAt: true },
        take: 500,
      }),
      this.prisma.payment.aggregate({
        where: {
          paymentType: 'incoming',
          status: 'completed',
          paymentDate: { gte: lastWeekStart, lt: lastWeekEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

    let avgCloseDays: number | null = null;
    if (lastWeekClosedRows.length > 0) {
      const sum = lastWeekClosedRows.reduce((acc, f) => {
        if (!f.closedAt) return acc;
        return acc + (f.closedAt.getTime() - f.createdAt.getTime()) / 86400000;
      }, 0);
      avgCloseDays = Math.round((sum / lastWeekClosedRows.length) * 10) / 10;
    }

    const slaRows = lastWeekClosedRows.filter((f) => f.slaDueAt && f.closedAt);
    const slaOkCount = slaRows.filter(
      (f) => f.closedAt!.getTime() <= f.slaDueAt!.getTime(),
    ).length;
    const slaTotal = slaRows.length;

    const result: DailyFlowResult = {
      today: {
        newClaims,
        newEmergencies,
        plannedOperations: plannedFileAppts + plannedAppts + plannedTasks,
        completedOperations: completedClaims + completedEmergencies + completedTasks,
      },
      teamDensity: DAY_LABELS.map((label, dayIndex) => ({
        dayIndex,
        label,
        count: dayCounts[dayIndex] ?? 0,
      })),
      lastWeek: {
        closedClaims: lastWeekClosed,
        collectionAmount: lastWeekCollections._sum.amount ?? 0,
        avgCloseDays,
        slaCompliancePct: slaTotal > 0 ? Math.round((slaOkCount / slaTotal) * 100) : null,
        rangeStart: lastWeekStart.toISOString(),
        rangeEnd: new Date(lastWeekEnd.getTime() - 1).toISOString(),
      },
    };

    this.cache.set(cacheKey, result, DASHBOARD_DAILY_FLOW_TTL_SEC).catch(() => {});
    return result;
  }
}
