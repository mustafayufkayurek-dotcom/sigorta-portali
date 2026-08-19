'use client';

import { Banknote, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { WidgetBoundary } from '../widget-frame';
import { KpiCard } from '../kpi';
import { useFinanceBottlenecks, usePortfolioPL } from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

interface FinanceKpiGroupProps {
  year: number;
  month: number;
  staggerIndex?: number;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function periodLabel(year: number, month: number): string {
  if (month > 0) return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
  return `${year} — tüm yıl`;
}

export function FinanceKpiGroup({ year, month, staggerIndex = 0 }: FinanceKpiGroupProps) {
  const plQuery = usePortfolioPL(year, month);
  const bottlenecksQuery = useFinanceBottlenecks();

  const pl = plQuery.data;
  const bottlenecks = bottlenecksQuery.data;
  const pendingCount = Array.isArray(bottlenecks?.pendingPayments) ? bottlenecks.pendingPayments.length : 0;

  const isLoading = plQuery.isLoading && bottlenecksQuery.isLoading;
  const plFailed = plQuery.isError;
  const bottlenecksFailed = bottlenecksQuery.isError;

  const period = periodLabel(year, month);
  const netProfit = pl?.netProfit ?? 0;

  return (
    <WidgetBoundary>
      <section
        className={`grid grid-cols-1 gap-3 transition-all duration-500 ease-out sm:grid-cols-2 xl:grid-cols-4 ${
          isLoading ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))
        ) : (
          <>
            {plFailed && bottlenecksFailed ? (
              <div className="col-span-full rounded-lg border border-red-200/70 bg-red-50/80 px-4 py-5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
                Finans KPI verileri yüklenemedi.
                <button
                  type="button"
                  onClick={() => {
                    void plQuery.refetch();
                    void bottlenecksQuery.refetch();
                  }}
                  className="ml-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : (
              <>
            {plFailed ? (
              <div className="col-span-full rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                Dönem P/L yüklenemedi; tahsilat kartları güncel.
              </div>
            ) : null}
            {bottlenecksFailed && !plFailed ? (
              <div className="col-span-full rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                Tahsilat kuyruğu yüklenemedi; dönem kartları güncel.
              </div>
            ) : null}
            <KpiCard
              icon={Banknote}
              label="Tahsil Edilen"
              value={plFailed ? '—' : formatCurrency(pl?.totalCollected ?? 0)}
              color="bg-emerald-600"
              subtext={pl && !plFailed ? `${period} · ${pl.fileCount} dosya` : period}
              emptyHint="Seçili dönemde tahsilat kaydı bulunmuyor."
              href="/panel/finans/tahsilatlar?paymentType=incoming&status=completed"
            />
            <KpiCard
              icon={Clock}
              label="Bekleyen Tahsilat"
              value={formatCurrency(bottlenecksFailed ? 0 : (bottlenecks?.totalPendingAmount ?? pl?.outstandingBalance ?? 0))}
              color="bg-amber-600"
              subtext={pendingCount > 0 ? `${pendingCount} kuyruk kaydı` : 'Tahsilat kuyruğu'}
              emptyHint="Bekleyen tahsilat kaydı görünmüyor."
              href="/panel/finans/tahsilatlar?paymentType=incoming&status=pending"
            />
            <KpiCard
              icon={TrendingDown}
              label="Operasyon Gideri"
              value={plFailed ? '—' : formatCurrency(pl?.totalCost ?? 0)}
              color="bg-rose-600"
              subtext={
                pl && !plFailed
                  ? `Değişken ${formatCurrency(pl.totalVariableCost)} · overhead ${formatCurrency(pl.overheadShare)}`
                  : period
              }
              emptyHint="Seçili dönemde gider kaydı bulunmuyor."
              href="/panel/finans/masraflar"
            />
            <KpiCard
              icon={TrendingUp}
              label="Net Sonuç"
              value={plFailed ? '—' : formatCurrency(netProfit)}
              color={!plFailed && netProfit >= 0 ? 'bg-slate-700' : 'bg-red-600'}
              subtext={pl && !plFailed && pl.totalRevenue > 0 ? `Marj %${pl.netMarginPct}` : period}
              emptyHint="Net sonuç hesaplanacak dosya özeti yok."
              href="/panel/finans/karlilik"
            />
              </>
            )}
          </>
        )}
      </section>
    </WidgetBoundary>
  );
}
