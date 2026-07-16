'use client';

import {
  Banknote,
  CheckCircle2,
  Landmark,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
  FileCheck2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { WidgetBoundary } from '../widget-frame';
import { StripKpi, computeChangePct, type StripKpiTrend } from '../kpi/strip-kpi';
import { useClaimFileCount, usePortfolioPL } from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type ManagementPeriod = 'today' | 'week' | 'month';

type AdminManagementKpiBandProps = {
  staggerIndex?: number;
};

const PERIOD_TABS: { id: ManagementPeriod; label: string }[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Bu Hafta' },
  { id: 'month', label: 'Bu Ay' },
];

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function fmtPrev(amount: number): string {
  return `Önceki: ${formatCurrency(amount)}`;
}

function trendFrom(current: number, previous: number, positiveIsGood = true): StripKpiTrend {
  return {
    pct: computeChangePct(current, previous),
    positiveIsGood,
  };
}

/**
 * C1 — Şirket Yönetimi: finansal yönetim KPI şeridi (StripKpi; kart büyütme yok).
 * Portföy P/L yalnızca ay bazlı; Bugün/Bu Hafta için sahte ciro yok → "—".
 */
export function AdminManagementKpiBand({ staggerIndex = 0 }: AdminManagementKpiBandProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prev = previousMonth(year, month);

  const [period, setPeriod] = useState<ManagementPeriod>('month');
  const plEnabled = period === 'month';

  const plQuery = usePortfolioPL(year, month);
  const prevPlQuery = usePortfolioPL(prev.year, prev.month);
  const approvedQuery = useClaimFileCount(
    'approved-reports',
    { repairReportStatus: 'approved' },
    true,
  );

  const pl = plQuery.data;
  const prevPl = prevPlQuery.data;
  const isLoading =
    (plEnabled && (plQuery.isLoading || prevPlQuery.isLoading || plQuery.isFetching)) ||
    approvedQuery.isLoading;
  const isError = plEnabled && plQuery.isError;

  const metrics = useMemo(() => {
    if (!plEnabled || !pl) {
      return null;
    }
    const prevSafe = prevPl ?? {
      totalRevenue: 0,
      totalCost: 0,
      totalVariableCost: 0,
      netProfit: 0,
      netMarginPct: 0,
      totalCollected: 0,
    };
    const grossProfit = pl.totalRevenue - pl.totalVariableCost;
    const prevGross = prevSafe.totalRevenue - prevSafe.totalVariableCost;
    return {
      revenue: pl.totalRevenue,
      prevRevenue: prevSafe.totalRevenue,
      grossProfit,
      prevGross,
      cost: pl.totalCost,
      prevCost: prevSafe.totalCost,
      netProfit: pl.netProfit,
      prevNet: prevSafe.netProfit,
      margin: pl.netMarginPct,
      prevMargin: prevSafe.netMarginPct,
      collected: pl.totalCollected,
      prevCollected: prevSafe.totalCollected,
    };
  }, [pl, prevPl, plEnabled]);

  const dash = '—';
  const periodGapSub = 'Dönem API Yok';
  const snapSub = 'Güncel Stok';

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Şirket Yönetimi"
      data-testid="management-kpi-band"
    >
      <div className="mb-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200 sm:text-sm">
          Şirket Yönetimi
        </h2>
        <div
          className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
          role="tablist"
          aria-label="Yönetim Dönemi"
        >
          {PERIOD_TABS.map((tab) => {
            const active = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(tab.id)}
                className={`rounded px-2 py-1 text-[10px] font-medium transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <WidgetBoundary>
        {isLoading ? (
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(plQuery.error, 'Yönetim KPI verileri yüklenemedi.')}
            <button
              type="button"
              onClick={() => void plQuery.refetch()}
              className="ml-3 rounded-md border border-red-300 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              Tekrar Dene
            </button>
          </div>
        ) : (
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
            <StripKpi
              icon={TrendingUp}
              label="Ciro"
              value={metrics ? formatCurrency(metrics.revenue) : dash}
              color="bg-emerald-600"
              href="/panel/finans/karlilik"
              subtext={metrics ? fmtPrev(metrics.prevRevenue) : periodGapSub}
              trend={metrics ? trendFrom(metrics.revenue, metrics.prevRevenue) : undefined}
            />
            <StripKpi
              icon={Wallet}
              label="Kâr"
              value={metrics ? formatCurrency(metrics.grossProfit) : dash}
              color="bg-teal-600"
              href="/panel/finans/karlilik"
              subtext={metrics ? fmtPrev(metrics.prevGross) : periodGapSub}
              trend={metrics ? trendFrom(metrics.grossProfit, metrics.prevGross) : undefined}
            />
            <StripKpi
              icon={TrendingDown}
              label="Operasyon Gideri"
              value={metrics ? formatCurrency(metrics.cost) : dash}
              color="bg-rose-600"
              href="/panel/finans/masraflar"
              subtext={metrics ? fmtPrev(metrics.prevCost) : periodGapSub}
              trend={
                metrics ? trendFrom(metrics.cost, metrics.prevCost, false) : undefined
              }
            />
            <StripKpi
              icon={Banknote}
              label="Net Kâr"
              value={metrics ? formatCurrency(metrics.netProfit) : dash}
              color={metrics && metrics.netProfit < 0 ? 'bg-red-600' : 'bg-slate-700'}
              href="/panel/finans/karlilik"
              subtext={metrics ? fmtPrev(metrics.prevNet) : periodGapSub}
              trend={metrics ? trendFrom(metrics.netProfit, metrics.prevNet) : undefined}
            />
            <StripKpi
              icon={Percent}
              label="Karlılık Oranı"
              value={metrics ? `%${metrics.margin.toFixed(1)}` : dash}
              color="bg-indigo-600"
              href="/panel/finans/karlilik"
              subtext={
                metrics ? `Önceki: %${metrics.prevMargin.toFixed(1)}` : periodGapSub
              }
              trend={metrics ? trendFrom(metrics.margin, metrics.prevMargin) : undefined}
            />
            <StripKpi
              icon={FileCheck2}
              label="Onaylanan Dosya"
              value={
                approvedQuery.isError
                  ? dash
                  : approvedQuery.data != null
                    ? approvedQuery.data
                    : dash
              }
              color="bg-blue-600"
              href="/panel/hasar-dosyalari?repairReportStatus=approved"
              subtext={snapSub}
            />
            <StripKpi
              icon={Landmark}
              label="Finansa Aktarılan Dosya"
              value={dash}
              color="bg-violet-600"
              href="/panel/finans"
              subtext="API Gap · Dönem Sayımı Yok"
            />
            <StripKpi
              icon={CheckCircle2}
              label="Tahsilat"
              value={metrics ? formatCurrency(metrics.collected) : dash}
              color="bg-cyan-600"
              href="/panel/finans/tahsilatlar?paymentType=incoming&status=completed"
              subtext={metrics ? fmtPrev(metrics.prevCollected) : periodGapSub}
              trend={
                metrics ? trendFrom(metrics.collected, metrics.prevCollected) : undefined
              }
            />
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
