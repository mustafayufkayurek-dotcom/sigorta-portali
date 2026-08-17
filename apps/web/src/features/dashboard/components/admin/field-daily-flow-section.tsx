'use client';

import { AlertTriangle, ArrowRight, FolderOpen, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { useMyPerformance, usePendingActions } from '../../hooks/use-dashboard-data';

type FieldDailyFlowSectionProps = {
  staggerIndex?: number;
};

/** Saha: Günün Akışı — finans / onay gecikmesi yok; atanan dosya odaklı */
export function FieldDailyFlowSection({ staggerIndex = 0 }: FieldDailyFlowSectionProps) {
  const perfQuery = useMyPerformance();
  const pendingQuery = usePendingActions();

  const perf = perfQuery.data;
  const pendingCount = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items.length : 0;
  const loading = perfQuery.isLoading || pendingQuery.isLoading;

  const flowItems = [
    {
      title: 'Açık Dosyalarım',
      value: loading ? '—' : (perf?.openFiles ?? '—'),
      detail:
        perf && !loading
          ? `${perf.totalFiles} Atanan Dosya`
          : 'Size Atanan Açık Dosyalar',
      icon: FolderOpen,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    {
      title: 'SLA Riski',
      value: loading ? '—' : (perf?.slaViolations ?? '—'),
      detail:
        perf && !loading && perf.slaViolations > 0
          ? `Ort. ${perf.avgDelayDays} Gün Gecikme`
          : 'SLA Aşımı Yok',
      icon: AlertTriangle,
      iconClassName: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      path: '/panel/hasar-dosyalari?status=sla_exceeded',
    },
    {
      title: 'Bekleyen Aksiyonlarım',
      value: loading ? '—' : pendingCount,
      detail: pendingCount > 0 ? 'İşlem Bekleyen Kayıtlar' : 'Bekleyen Kayıt Yok',
      icon: ListTodo,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
  ];

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Günün Akışı</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
          Atanan dosyalarınız, SLA riskleri ve saha aksiyonları
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {flowItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.path}
              className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-2.5 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`rounded-lg p-1.5 ${item.iconClassName}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {item.title}
                  </span>
                  <span className="block text-[10px] text-slate-400">{item.detail}</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-base font-bold text-slate-950 dark:text-white">{item.value}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
