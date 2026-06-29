'use client';

import { ArrowRight, Banknote, Building2, FileText, Receipt } from 'lucide-react';
import Link from 'next/link';
import {
  useFinanceBottlenecks,
  useOverheadPeriodStatus,
  usePortfolioPL,
} from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

type FlowItem = {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof Banknote;
  iconClassName: string;
  path: string;
};

interface FinanceFlowStripProps {
  year: number;
  month: number;
}

export function FinanceFlowStrip({ year, month }: FinanceFlowStripProps) {
  const bottlenecksQuery = useFinanceBottlenecks();
  const plQuery = usePortfolioPL(year, month);
  const periodMonth = month > 0 ? month : new Date().getMonth() + 1;
  const periodYear = month > 0 ? year : new Date().getFullYear();
  const overheadQuery = useOverheadPeriodStatus(periodYear, periodMonth);

  const bottlenecks = bottlenecksQuery.data;
  const pl = plQuery.data;
  const overhead = overheadQuery.data;
  const pendingCount = Array.isArray(bottlenecks?.pendingPayments) ? bottlenecks.pendingPayments.length : 0;
  const overdueInvoices = bottlenecks?.overdueInvoices ?? 0;
  const overheadEntries = overhead?.entryCount ?? 0;

  const items: FlowItem[] = [
    {
      title: 'Tahsilatlar',
      value: formatCurrency(bottlenecks?.totalPendingAmount ?? 0),
      detail: pendingCount > 0 ? `${pendingCount} bekleyen kuyruk` : 'Tahsilat kuyruğu',
      icon: Banknote,
      iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      path: '/panel/finans/tahsilatlar?paymentType=incoming&status=pending',
    },
    {
      title: 'Faturalar',
      value: overdueInvoices,
      detail: overdueInvoices > 0 ? 'Geciken fatura' : 'Fatura takibi',
      icon: FileText,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/finans/faturalar',
    },
    {
      title: 'Masraflar',
      value: pl ? formatCurrency(pl.totalVariableCost) : '—',
      detail: pl ? `${pl.fileCount} dosya gider özeti` : 'Dosya masrafları',
      icon: Receipt,
      iconClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      path: '/panel/finans/masraflar',
    },
    {
      title: 'Sabit Giderler',
      value: overheadEntries,
      detail: overhead?.allocationComplete
        ? 'Bu dönem dağıtım tamam'
        : overhead?.needsAllocation
          ? 'Dağıtım bekliyor'
          : 'Yönetim gideri havuzu',
      icon: Building2,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: `/panel/finans/sabit-giderler?year=${periodYear}&month=${periodMonth}`,
    },
  ];

  const isFetching = bottlenecksQuery.isFetching || plQuery.isFetching || overheadQuery.isFetching;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Finans Akışı</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tahsilat, fatura, masraf ve sabit gider hareketlerini tek sırada izleyin.
          </p>
        </div>
        {isFetching && <span className="text-xs font-medium text-slate-400">Güncelleniyor</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.path}
              className="group flex min-h-[92px] items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`rounded-md p-2 ${item.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-slate-400">{item.detail}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-3">
                <span className="text-xl font-semibold text-slate-950 dark:text-white">{item.value}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
