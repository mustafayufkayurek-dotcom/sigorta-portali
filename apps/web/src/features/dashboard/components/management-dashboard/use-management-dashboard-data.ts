'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  FolderOpen,
  Percent,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { listSurveyCampaigns, type SurveyCampaign } from '@/utils/surveyApi';
import { computeChangePct } from '../kpi/strip-kpi';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  useDashboardOperations,
  useOwnershipLoad,
  usePortfolioPL,
  useSlaSummary,
} from '../../hooks/use-dashboard-data';
import { useApiQuery } from '@/hooks/useApi';
import type { MgmtKpiItem } from './MgmtKpiRow';
import type { MgmtSummaryCell } from './MgmtExecutiveSummary';
import type { StaffProductivityRow } from './MgmtStaffTable';
import type { DeptSlice, MarginPoint, TrendPoint } from './MgmtChartsRow';
import type { DeptFinanceRow } from './MgmtDepartmentTable';
import type { MgmtDateRange, MgmtPeriodPreset } from './period';

type UserPerformanceRow = {
  userId: string;
  userName: string;
  userType: string;
  totalFiles: number;
  openFiles: number;
  closedFiles: number;
  slaViolations: number;
  avgCloseDays: number;
};

type UserPerformanceResponse = { users: UserPerformanceRow[] };

type SlaOverall = {
  byStatus: unknown[];
  overall?: { total: number; healthy: number; atRisk: number; critical: number };
};

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** Portföy P/L ay bazlı; gün/hafta için sahte tutar üretme. */
function resolvePlPeriod(
  preset: MgmtPeriodPreset,
  range: MgmtDateRange,
): { mode: 'month' | 'year' | 'none'; year: number; month: number } {
  const from = new Date(`${range.dateFrom}T12:00:00`);
  const to = new Date(`${range.dateTo}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { mode: 'none', year: 0, month: 0 };
  }

  if (preset === 'bu_ay') {
    return { mode: 'month', year: to.getFullYear(), month: to.getMonth() + 1 };
  }
  if (preset === 'bu_yil') {
    return { mode: 'year', year: to.getFullYear(), month: 0 };
  }
  if (preset === 'bugun' || preset === 'bu_hafta') {
    return { mode: 'none', year: 0, month: 0 };
  }

  // Özel: tek ay ise o ay; aynı yıl ve ≥28 gün ise yıl; aksi none
  if (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  ) {
    return { mode: 'month', year: to.getFullYear(), month: to.getMonth() + 1 };
  }
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === 0 && to.getMonth() === 11) {
    return { mode: 'year', year: to.getFullYear(), month: 0 };
  }
  return { mode: 'none', year: 0, month: 0 };
}

function trendLabel(pct: number | null): {
  trendLabel: string | null;
  trendDirection: 'up' | 'down' | 'flat' | null;
} {
  if (pct == null || !Number.isFinite(pct)) {
    return { trendLabel: null, trendDirection: null };
  }
  if (Math.abs(pct) < 0.05) {
    return { trendLabel: '%0', trendDirection: 'flat' };
  }
  const rounded = pct.toLocaleString('tr-TR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  const sign = pct > 0 ? '+' : '';
  return {
    trendLabel: `${sign}%${rounded}`,
    trendDirection: pct > 0 ? 'up' : 'down',
  };
}

function averageSurveyScore(c: SurveyCampaign): number | null {
  const r = c.response;
  if (!r) return null;
  const scores = [r.q1Rating, r.q2Rating, r.q3Rating, r.q4Rating, r.q5Rating].filter(
    (n) => typeof n === 'number' && Number.isFinite(n),
  );
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function countNegativeFeedbackLast7Days(campaigns: SurveyCampaign[]): number {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return campaigns.filter((c) => {
    if (!c.response) return false;
    const submitted = new Date(c.response.submittedAt || c.completedAt || c.createdAt);
    if (Number.isNaN(submitted.getTime()) || submitted < from || submitted > to) return false;
    const avg = averageSurveyScore(c);
    const lowScore = avg != null && avg <= 2.5;
    const notRecommend = c.response.q6Recommend === false;
    const hasComment = Boolean(c.response.q7Comment?.trim());
    return lowScore || (notRecommend && hasComment) || (lowScore && hasComment);
  }).length;
}

function useUserPerformance() {
  return useApiQuery<UserPerformanceResponse>(
    ['dashboard-user-performance'],
    '/dashboard/user-performance',
  );
}

export function useManagementDashboardData(
  range: MgmtDateRange,
  preset: MgmtPeriodPreset,
) {
  const plPeriod = useMemo(() => resolvePlPeriod(preset, range), [preset, range]);
  const plEnabled = plPeriod.mode !== 'none';
  const plYear = plEnabled ? plPeriod.year : new Date().getFullYear();
  const plMonth = plPeriod.mode === 'month' ? plPeriod.month : 0;
  const prev =
    plPeriod.mode === 'month'
      ? previousMonth(plPeriod.year, plPeriod.month)
      : { year: plPeriod.year - 1, month: 0 };

  const plQuery = usePortfolioPL(plYear, plMonth);
  const prevPlQuery = usePortfolioPL(
    plPeriod.mode === 'month' ? prev.year : plYear - 1,
    plPeriod.mode === 'month' ? prev.month : 0,
  );
  const opsQuery = useDashboardOperations();
  const slaQuery = useSlaSummary();
  const ownershipQuery = useOwnershipLoad();
  const userPerfQuery = useUserPerformance();
  const surveysQuery = useQuery({
    queryKey: ['mgmt-surveys-for-summary'],
    queryFn: () => listSurveyCampaigns(),
    staleTime: 60_000,
  });

  const loading =
    opsQuery.isLoading ||
    slaQuery.isLoading ||
    ownershipQuery.isLoading ||
    userPerfQuery.isLoading ||
    surveysQuery.isLoading ||
    (plEnabled && (plQuery.isLoading || prevPlQuery.isLoading));

  const kpis = useMemo((): MgmtKpiItem[] => {
    const pl = plEnabled ? plQuery.data : undefined;
    const prevPl = plEnabled ? prevPlQuery.data : undefined;
    const ops = opsQuery.data;

    const moneyOrDash = (n: number | undefined) =>
      pl && n != null ? formatCurrency(n) : '—';

    const revTrend = trendLabel(
      pl && prevPl ? computeChangePct(pl.totalRevenue, prevPl.totalRevenue) : null,
    );
    const costTrend = trendLabel(
      pl && prevPl ? computeChangePct(pl.totalCost, prevPl.totalCost) : null,
    );
    const profitTrend = trendLabel(
      pl && prevPl ? computeChangePct(pl.netProfit, prevPl.netProfit) : null,
    );
    const marginTrend = trendLabel(
      pl && prevPl ? computeChangePct(pl.netMarginPct, prevPl.netMarginPct) : null,
    );

    const periodGap = !plEnabled
        ? 'Bu dönem için finans API yok'
      : plQuery.isError
        ? 'Finans verisi alınamadı'
        : 'Önceki döneme göre';

    return [
      {
        id: 'ciro',
        title: 'Toplam Ciro',
        value: moneyOrDash(pl?.totalRevenue),
        trendLabel: revTrend.trendLabel,
        trendTitle: periodGap,
        trendDirection: revTrend.trendDirection,
        icon: TrendingUp,
        iconClass: 'bg-blue-50 text-[#2563EB]',
      },
      {
        id: 'gider',
        title: 'Toplam Gider',
        value: moneyOrDash(pl?.totalCost),
        trendLabel: costTrend.trendLabel,
        trendTitle: periodGap,
        trendDirection: costTrend.trendDirection,
        icon: Receipt,
        iconClass: 'bg-emerald-50 text-[#16A34A]',
      },
      {
        id: 'kar',
        title: 'Toplam Kâr',
        value: moneyOrDash(pl?.netProfit),
        trendLabel: profitTrend.trendLabel,
        trendTitle: periodGap,
        trendDirection: profitTrend.trendDirection,
        icon: Wallet,
        iconClass: 'bg-violet-50 text-[#7C3AED]',
      },
      {
        id: 'marj',
        title: 'Kâr Marjı',
        value:
          pl && pl.netMarginPct != null
            ? `%${pl.netMarginPct.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
            : '—',
        trendLabel: marginTrend.trendLabel,
        trendTitle: periodGap,
        trendDirection: marginTrend.trendDirection,
        icon: Percent,
        iconClass: 'bg-amber-50 text-[#F59E0B]',
      },
      {
        id: 'acik',
        title: 'Açık Dosya',
        value: ops ? formatNumber(ops.openOperationalFiles ?? ops.openClaims ?? 0) : '—',
        trendLabel: null,
        trendTitle: 'Güncel stok',
        trendDirection: null,
        icon: FolderOpen,
        iconClass: 'bg-cyan-50 text-cyan-700',
      },
      {
        id: 'tamamlanan',
        title: 'Tamamlanan Dosya',
        value: ops ? formatNumber(ops.closedClaims ?? 0) : '—',
        trendLabel: null,
        trendTitle: 'Güncel stok',
        trendDirection: null,
        icon: FileCheck2,
        iconClass: 'bg-slate-100 text-slate-700',
      },
    ];
  }, [
    plEnabled,
    plQuery.data,
    plQuery.isError,
    prevPlQuery.data,
    opsQuery.data,
  ]);

  const summary = useMemo((): MgmtSummaryCell[] => {
    const negative = countNegativeFeedbackLast7Days(surveysQuery.data ?? []);
    const topStaff = (userPerfQuery.data?.users ?? [])[0];
    const bottlenecksCritical =
      (ownershipQuery.data?.items ?? []).filter((i) => (i.criticalFiles ?? 0) > 0).length;

    return [
      {
        id: 'week',
        title: 'Son 7 Gün',
        primary:
          negative > 0
            ? `${formatNumber(negative)} Olumsuz Geri Bildirim Alındı`
            : 'Olumsuz Geri Bildirim Yok',
        tone: negative > 0 ? 'alert' : 'positive',
        detailHref: '/panel/anketler/sonuclar',
      },
      {
        id: 'ciro',
        title: 'En Yüksek Ciro',
        primary: 'Departman Kırılımı Henüz Yok',
        secondary: 'Toplam ciro KPI’da görünür',
        tone: 'neutral',
        detailHref: '/panel/finans/karlilik',
      },
      {
        id: 'gider',
        title: 'En Yüksek Gider',
        primary: 'Departman Kırılımı Henüz Yok',
        tone: 'neutral',
        detailHref: '/panel/finans/masraflar',
      },
      {
        id: 'marj',
        title: 'En Yüksek Kâr Marjı',
        primary: 'Departman Kırılımı Henüz Yok',
        tone: 'neutral',
        detailHref: '/panel/finans/karlilik',
      },
      {
        id: 'dikkat',
        title: 'Dikkat Gereken',
        primary:
          bottlenecksCritical > 0
            ? `${formatNumber(bottlenecksCritical)} Personelde Kritik Dosya Var`
            : 'Kritik Sahiplik Uyarısı Yok',
        tone: bottlenecksCritical > 0 ? 'warning' : 'neutral',
        detailHref: '/panel/sahiplik',
      },
      {
        id: 'personel',
        title: 'Öne Çıkan Personel',
        primary: topStaff?.userName?.trim() || 'Personel Verisi Yok',
        secondary: topStaff
          ? `${formatNumber(topStaff.closedFiles)} Tamamlanan Dosya`
          : undefined,
        tone: topStaff ? 'positive' : 'neutral',
        showAvatar: Boolean(topStaff?.userName),
        detailHref: '/panel/sahiplik#personel-verimlilik',
      },
    ];
  }, [surveysQuery.data, userPerfQuery.data, ownershipQuery.data]);

  const staffRows = useMemo((): StaffProductivityRow[] => {
    const users = userPerfQuery.data?.users ?? [];
    const ownershipById = new Map(
      (ownershipQuery.data?.items ?? []).map((i) => [i.userId, i] as const),
    );

    return users.map((u) => {
      const own = ownershipById.get(u.userId);
      const successRate =
        u.totalFiles > 0
          ? Math.round((u.closedFiles / u.totalFiles) * 100)
          : null;
      return {
        id: u.userId,
        name: u.userName.trim() || '—',
        department: u.userType || own?.role || '—',
        taskDistribution: `${u.totalFiles} dosya`,
        completedFiles: formatNumber(u.closedFiles),
        successRate: successRate != null ? `%${successRate}` : '—',
        avgResolution:
          u.avgCloseDays > 0
            ? `${u.avgCloseDays.toLocaleString('tr-TR')} gün`
            : own?.avgDaysPerFile != null
              ? `${Number(own.avgDaysPerFile).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} gün`
              : '—',
        profitContribution: '—',
        satisfaction: null,
      };
    });
  }, [userPerfQuery.data, ownershipQuery.data]);

  const sla = useMemo(() => {
    const overall = (slaQuery.data as SlaOverall | undefined)?.overall;
    const total = overall?.total ?? 0;
    const healthy = overall?.healthy ?? 0;
    const delayed = (overall?.atRisk ?? 0) + (overall?.critical ?? 0);
    const slaPct = total > 0 ? Math.round((healthy / total) * 100) : 0;
    return {
      slaPct,
      slices: [
        { name: 'Zamanında', value: healthy, fill: '#16A34A' },
        { name: 'Geciken', value: delayed, fill: '#EF4444' },
      ],
    };
  }, [slaQuery.data]);

  const emptyTrend: TrendPoint[] = [];
  const emptyDepartments: DeptSlice[] = [];
  const emptyMargins: MarginPoint[] = [];
  const emptyDeptRows: DeptFinanceRow[] = [];

  return {
    loading,
    kpis,
    summary,
    staffRows,
    deptRows: emptyDeptRows,
    deptDataAvailable: false,
    trend: emptyTrend,
    departments: emptyDepartments,
    margins: emptyMargins,
    slaPct: sla.slaPct,
    slaSlices: sla.slices,
  };
}
