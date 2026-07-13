'use client';

import { ArrowRight, ClipboardCheck, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import {
  useApprovalDelays,
  useDashboardOperations,
  usePendingActions,
} from '../../hooks/use-dashboard-data';

type OfficeDailyFlowSectionProps = {
  hideAcil?: boolean;
  staggerIndex?: number;
};

/** Dosya sorumlusu: Günün Akışı — finans kartı yok; admin görsel dili */
export function OfficeDailyFlowSection({ hideAcil = false, staggerIndex = 0 }: OfficeDailyFlowSectionProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();
  const approvalQuery = useApprovalDelays();

  const ops = opsQuery.data;
  const pendingCount = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items.length : 0;
  const approvalTotal = approvalQuery.data?.summary?.total ?? 0;
  const loading = opsQuery.isLoading || pendingQuery.isLoading || approvalQuery.isLoading;

  const flowItems = [
    {
      title: 'Açık Hasar Dosyalarım',
      value: loading ? '—' : (ops?.openClaims ?? '—'),
      detail: ops && !loading ? `${ops.totalClaims} toplam dosya` : 'Atanan hasar',
      icon: HASAR_OPERATION_ICON,
      iconClassName: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
    ...(hideAcil
      ? []
      : [
          {
            title: 'Açık Acil Dosyalarım',
            value: loading ? '—' : (ops?.openEmergencyCases ?? '—'),
            detail: ops && !loading ? `${ops.totalEmergencyCases} toplam dosya` : 'Atanan acil',
            icon: ACIL_OPERATION_ICON,
            iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
            path: '/panel/acil-yardim',
          },
        ]),
    {
      title: 'Onay Gecikmesi',
      value: loading ? '—' : approvalTotal,
      detail: approvalTotal > 0 ? '24 saat üzeri bekleyen rapor' : 'Geciken onay yok',
      icon: ClipboardCheck,
      iconClassName: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
      path: '/panel/hasar-dosyalari?repairReportStatus=pending_approval',
    },
    {
      title: 'Bekleyen Aksiyonlarım',
      value: loading ? '—' : pendingCount,
      detail: pendingCount > 0 ? 'İşlem bekleyen kayıtlar' : 'Bekleyen kayıt yok',
      icon: ListTodo,
      iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      path: '/panel/hasar-dosyalari?status=open',
    },
  ];

  const colCount = hideAcil ? 3 : 4;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Günün Akışı</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
          Atanan dosyalarınız, onay gecikmeleri ve bekleyen aksiyonlar
        </p>
      </div>

      <div
        className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${
          colCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
        }`}
      >
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
