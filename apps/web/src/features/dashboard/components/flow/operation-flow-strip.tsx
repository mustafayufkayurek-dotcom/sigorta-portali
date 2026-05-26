'use client';

import { ArrowRight, Banknote, FileText, ListTodo, Siren } from 'lucide-react';
import { useDashboardOperations, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

interface OperationFlowStripProps {
  onNavigate?: (path: string) => void;
}

type FlowItem = {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof FileText;
  iconClassName: string;
  path: string;
};

export function OperationFlowStrip({ onNavigate }: OperationFlowStripProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();
  const ops = opsQuery.data;
  const pendingCount = pendingQuery.data?.items?.length ?? 0;

  const items: FlowItem[] = [
    {
      title: 'Hasar Dosyaları',
      value: ops?.openClaims ?? '—',
      detail: ops ? `${ops.totalClaims} toplam dosya` : 'Veri bekleniyor',
      icon: FileText,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    {
      title: 'Acil Yardım',
      value: ops?.openEmergencyCases ?? '—',
      detail: ops ? `${ops.totalEmergencyCases} toplam dosya` : 'Veri bekleniyor',
      icon: Siren,
      iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
      path: '/panel/acil-yardim',
    },
    {
      title: 'Bekleyen Aksiyon',
      value: pendingCount,
      detail: 'Operasyon takibi',
      icon: ListTodo,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    {
      title: 'Geciken Tahsilat',
      value: ops ? formatCurrency(ops.overdueCollectionAmount) : '—',
      detail: 'Finans takibi',
      icon: Banknote,
      iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      path: '/panel/finans/tahsilatlar?paymentType=incoming&status=pending',
    },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Günlük İş Akışı</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dosya, aksiyon ve finans hareketlerini tek sırada izleyin.
          </p>
        </div>
        {(opsQuery.isFetching || pendingQuery.isFetching) && (
          <span className="text-xs font-medium text-slate-400">Güncelleniyor</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onNavigate?.(item.path)}
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
