'use client';

import { ArrowRight, CheckCircle2, ClipboardList, PieChart } from 'lucide-react';
import Link from 'next/link';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import {
  useActivityFeed,
  useDashboardOperations,
  useOverheadPeriodStatus,
} from '../../hooks/use-dashboard-data';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type AdminDailyFlowSectionProps = {
  hideAcil?: boolean;
  staggerIndex?: number;
};

export function AdminDailyFlowSection({ hideAcil = false, staggerIndex = 0 }: AdminDailyFlowSectionProps) {
  const now = new Date();
  const opsQuery = useDashboardOperations();
  const activityQuery = useActivityFeed(80);
  const overheadQuery = useOverheadPeriodStatus(now.getFullYear(), now.getMonth() + 1);

  const ops = opsQuery.data;
  const activityItems = Array.isArray(activityQuery.data?.items) ? activityQuery.data.items : [];
  const todayStart = startOfToday();
  const todayActivity = activityItems.filter((item) => item.createdAt && new Date(item.createdAt) >= todayStart);

  const allocationDone = overheadQuery.data?.allocationComplete === true;
  const loading = opsQuery.isLoading || activityQuery.isLoading || overheadQuery.isLoading;

  const flowItems = [
    {
      title: 'Yeni Hasar',
      value: loading ? '—' : todayActivity.length,
      detail: 'Bugün hareket',
      icon: HASAR_OPERATION_ICON,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari',
    },
    ...(hideAcil
      ? []
      : [{
          title: 'Yeni Acil',
          value: loading ? '—' : (ops?.openEmergencyCases ?? '—'),
          detail: 'Açık dosya',
          icon: ACIL_OPERATION_ICON,
          iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
          path: '/panel/acil-yardim',
        }]),
    {
      title: 'Planlanan Operasyon',
      value: loading ? '—' : (ops?.pendingTasks ?? '—'),
      detail: 'Bekleyen görev',
      icon: ClipboardList,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    {
      title: 'Tamamlanan Operasyon',
      value: loading ? '—' : todayActivity.length,
      detail: 'Bugün hareket',
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      path: '/panel/hasar-dosyalari?status=closed',
    },
  ];

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Günün Akışı</h2>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${hideAcil ? 'xl:grid-cols-[1fr_240px]' : 'xl:grid-cols-[1fr_260px]'}`}>
        <div className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${hideAcil ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
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
                    <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">{item.title}</span>
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

        <Link
          href="/panel/finans/sabit-giderler"
          className={`flex flex-col justify-between rounded-xl border p-3 transition-colors ${
            allocationDone
              ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700'
              : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg p-1.5 ${allocationDone ? 'bg-emerald-500/40' : 'bg-amber-200/80'}`}>
                <PieChart className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold sm:text-sm">Gider Dağıtımı</p>
                <p className={`mt-0.5 text-[10px] sm:text-xs ${allocationDone ? 'text-emerald-100' : 'text-amber-800/90 dark:text-amber-200/90'}`}>
                  {allocationDone
                    ? 'Dağıtım tamamlandı ve mutabakat sağlandı'
                    : 'Ay sonu dağıtım bekliyor — havuzu kontrol edin'}
                </p>
              </div>
            </div>
            {allocationDone ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-white/90" />
            ) : null}
          </div>
          <span className={`mt-2 text-[10px] font-medium sm:text-xs ${allocationDone ? 'text-emerald-100' : 'text-amber-700 dark:text-amber-300'}`}>
            {allocationDone ? 'Tamamlandı' : 'Detay için tıklayın'}
          </span>
        </Link>
      </div>
    </section>
  );
}
