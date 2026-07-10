'use client';

import { Banknote, CheckCircle2, Clock, FileText, TrendingDown } from 'lucide-react';
import { WidgetBoundary } from '../widget-frame';
import { KpiCard } from '../kpi';
import { FinancePeriodSelector } from '../finance/finance-period-selector';
import {
  useDashboardOperations,
  useFinanceBottlenecks,
  useOverheadPeriodStatus,
  usePortfolioPL,
} from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

type AdminFinanceSummarySectionProps = {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  staggerIndex?: number;
};

export function AdminFinanceSummarySection({
  year,
  month,
  onYearChange,
  onMonthChange,
  staggerIndex = 0,
}: AdminFinanceSummarySectionProps) {
  const opsQuery = useDashboardOperations();
  const plQuery = usePortfolioPL(year, month);
  const bottlenecksQuery = useFinanceBottlenecks();
  const overheadQuery = useOverheadPeriodStatus(year, month);

  const ops = opsQuery.data;
  const pl = plQuery.data;
  const bottlenecks = bottlenecksQuery.data;
  const overhead = overheadQuery.data;

  const isLoading =
    opsQuery.isLoading || plQuery.isLoading || bottlenecksQuery.isLoading || overheadQuery.isLoading;

  const overdueInvoices = bottlenecks?.overdueInvoices ?? 0;
  const allocationDone = overhead?.allocationComplete === true;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Finans Özeti</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gelir, gider ve tahsilat görünümü</p>
        </div>
        <FinancePeriodSelector year={year} month={month} onYearChange={onYearChange} onMonthChange={onMonthChange} />
      </div>

      <WidgetBoundary>
        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-500 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5 ${
            isLoading ? 'opacity-60' : 'opacity-100'
          }`}
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))
          ) : (
            <>
              <KpiCard
                icon={Banknote}
                label="Geciken Tahsilat"
                value={formatCurrency(ops?.overdueCollectionAmount ?? 0)}
                color="bg-rose-600"
                href="/panel/finans/tahsilatlar?paymentType=incoming&status=pending"
              />
              <KpiCard
                icon={FileText}
                label="Bekleyen Fatura"
                value={overdueInvoices > 0 ? overdueInvoices : '—'}
                color="bg-amber-600"
                subtext={formatCurrency(bottlenecks?.totalPendingAmount ?? 0)}
                href="/panel/finans/faturalar"
              />
              <KpiCard
                icon={TrendingDown}
                label="Aylık Gelir"
                value={formatCurrency(pl?.totalRevenue ?? 0)}
                color="bg-emerald-600"
                subtext={pl ? `${pl.fileCount} dosya` : undefined}
                href="/panel/finans/karlilik"
              />
              <KpiCard
                icon={Clock}
                label="Operasyon Gideri"
                value={formatCurrency(pl?.totalCost ?? 0)}
                color="bg-blue-600"
                href="/panel/finans/masraflar"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Dağıtım Durumu"
                value={allocationDone ? 'Tamamlandı' : 'Bekliyor'}
                color={allocationDone ? 'bg-emerald-600' : 'bg-amber-600'}
                subtext={overhead?.needsSync ? 'Senkron gerekli' : undefined}
                href="/panel/finans/sabit-giderler"
              />
            </>
          )}
        </div>
      </WidgetBoundary>
    </section>
  );
}
