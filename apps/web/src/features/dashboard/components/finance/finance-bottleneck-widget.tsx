'use client';

import { ListChecks, TrendingUp } from 'lucide-react';
import { useFinanceBottlenecks } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { formatCurrency } from '../../utils/formatters';

interface FinanceBottleneckWidgetProps {
  onNavigate?: (path: string) => void;
  staggerIndex?: number;
}

export function FinanceBottleneckWidget({ onNavigate, staggerIndex = 0 }: FinanceBottleneckWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useFinanceBottlenecks();

  return (
    <WidgetShell
      title="Finans Darboğazları"
      icon={<ListChecks className="h-5 w-5 text-emerald-600" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'Finans darboğazları yüklenemedi.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={4} />
      ) : !data?.pendingPayments?.length && !data?.overdueInvoices ? (
        <WidgetEmpty
          icon={TrendingUp}
          message="Fatura kaydı bulunmuyor."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500">Toplam Bekleyen</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(data?.totalPendingAmount || 0)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500">Geciken Fatura</p>
              <p className="text-2xl font-bold text-red-600">{data?.overdueInvoices || 0}</p>
            </div>
          </div>
          {(data?.pendingPayments || []).length > 0 && (
            <div className="space-y-2">
              {data!.pendingPayments.slice(0, 5).map((item) => (
                <button
                  key={`${item.fileNo}-${item.insuranceCompany}`}
                  type="button"
                  onClick={() => onNavigate?.('/panel/hasar-dosyalari')}
                  className="grid w-full grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 md:grid-cols-4"
                >
                  <span className="font-semibold">{item.fileNo}</span>
                  <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(item.amount)}</span>
                  <span className="text-slate-500">{item.daysPending} gün</span>
                  <span className="truncate text-slate-600 dark:text-slate-400">{item.insuranceCompany}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
