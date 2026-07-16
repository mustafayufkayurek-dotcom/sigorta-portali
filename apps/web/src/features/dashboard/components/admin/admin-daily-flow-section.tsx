'use client';

import { ArrowRight, CheckCircle2, ClipboardList, PieChart } from 'lucide-react';
import Link from 'next/link';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import {
  useDailyFlow,
  useOverheadPeriodStatus,
} from '../../hooks/use-dashboard-data';

type AdminDailyFlowSectionProps = {
  hideAcil?: boolean;
  staggerIndex?: number;
};

/**
 * Günün Akışı — 5 dengeli kart (4 akış + Gider); Gider ≤1.25x;
 * eşit yükseklik, line-clamp, 1440 horizontal scroll yok.
 */
export function AdminDailyFlowSection({ hideAcil = false, staggerIndex = 0 }: AdminDailyFlowSectionProps) {
  const now = new Date();
  const flowQuery = useDailyFlow();
  const overheadQuery = useOverheadPeriodStatus(now.getFullYear(), now.getMonth() + 1);

  const today = flowQuery.data?.today;
  const allocationDone = overheadQuery.data?.allocationComplete === true;
  const loading = flowQuery.isLoading || overheadQuery.isLoading;

  const flowItems = [
    {
      title: 'Yeni Hasar',
      value: loading ? '—' : (today?.newClaims ?? 0),
      detail: 'Bugün açılan',
      icon: HASAR_OPERATION_ICON,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari',
    },
    ...(hideAcil
      ? []
      : [
          {
            title: 'Yeni Acil',
            value: loading ? '—' : (today?.newEmergencies ?? 0),
            detail: 'Bugün açılan',
            icon: ACIL_OPERATION_ICON,
            iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
            path: '/panel/operasyon?filter=acil',
          },
        ]),
    {
      title: 'Planlanan Operasyon',
      value: loading ? '—' : (today?.plannedOperations ?? 0),
      detail: 'Bugün planlı',
      icon: ClipboardList,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    {
      title: 'Tamamlanan Operasyon',
      value: loading ? '—' : (today?.completedOperations ?? 0),
      detail: 'Bugün kapanış',
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      path: '/panel/hasar-dosyalari?status=closed',
    },
  ];

  const peerCount = flowItems.length;
  const gridClass =
    peerCount >= 4
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.25fr)]'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.25fr)]';

  return (
    <section
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2 flex items-end justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white sm:text-base">
            Günün Akışı
          </h2>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
            Bugünkü açılış, plan ve tamamlanan operasyonlar
          </p>
        </div>
      </div>

      <div className={`grid min-w-0 flex-1 auto-rows-fr items-stretch gap-2 ${gridClass}`}>
        {flowItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.path}
              className="group flex h-full min-h-[72px] min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-xl border border-slate-200 px-2.5 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className={`shrink-0 rounded-lg p-1.5 ${item.iconClassName}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {item.title}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400">{item.detail}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-lg font-bold tabular-nums text-slate-950 dark:text-white">
                  {item.value}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
            </Link>
          );
        })}

        <Link
          href="/panel/finans/sabit-giderler"
          className={`flex h-full min-h-[72px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border transition-colors ${
            allocationDone
              ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700'
              : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
          }`}
        >
          <div className="flex min-w-0 items-start gap-2 p-2.5">
            <span
              className={`shrink-0 rounded-lg p-1.5 ${
                allocationDone ? 'bg-emerald-500/40' : 'bg-amber-200/80'
              }`}
            >
              <PieChart className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold sm:text-xs">Gider Dağıtımı</p>
              <p
                className={`mt-0.5 line-clamp-2 text-[10px] leading-snug ${
                  allocationDone
                    ? 'text-emerald-100'
                    : 'text-amber-800/90 dark:text-amber-200/90'
                }`}
              >
                {allocationDone
                  ? 'Dağıtım Tamamlandı'
                  : 'Ay Sonu Dağıtım Bekliyor'}
              </p>
            </div>
            {allocationDone ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-white/90" />
            ) : null}
          </div>
          <span
            className={`truncate px-2.5 py-1.5 text-[11px] font-semibold ${
              allocationDone
                ? 'bg-emerald-500/50 text-white'
                : 'bg-amber-200/60 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
            }`}
          >
            {allocationDone ? 'Tamamlandı' : 'Detay İçin Tıklayın'}
          </span>
        </Link>
      </div>
    </section>
  );
}
