'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight, ListChecks, Users } from 'lucide-react';
import {
  useCriticalAlerts,
  useFinanceBottlenecks,
  useOwnershipLoad,
} from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';
import { WidgetSkeleton } from '../widget-frame';

type AdminBottomRowProps = {
  staggerIndex?: number;
};

export function AdminBottomRow({ staggerIndex = 0 }: AdminBottomRowProps) {
  const criticalQuery = useCriticalAlerts();
  const financeQuery = useFinanceBottlenecks();
  const ownershipQuery = useOwnershipLoad();

  const isLoading = criticalQuery.isLoading || financeQuery.isLoading || ownershipQuery.isLoading;

  const slaEscalations = criticalQuery.data?.slaEscalations ?? [];
  const inactiveFiles = criticalQuery.data?.inactiveFiles ?? [];
  const criticalItems = [
    ...slaEscalations.slice(0, 3).map((item) => ({
      key: `sla-${item.fileNo}`,
      label: `${item.fileNo} — SLA aşımı`,
      meta: 'SLA riski',
    })),
    ...inactiveFiles.slice(0, 2).map((item) => ({
      key: `inactive-${item.fileNo}`,
      label: `${item.fileNo} — Hareketsiz`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} gün` : '48 sa+',
    })),
  ].slice(0, 4);

  const pendingPayments = financeQuery.data?.pendingPayments ?? [];
  const staffItems = (ownershipQuery.data?.items ?? []).slice(0, 4);
  const maxFiles = Math.max(...staffItems.map((s) => s.activeFiles), 1);

  return (
    <section
      className="grid grid-cols-1 gap-2 lg:grid-cols-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Kritik Uyarılar</h3>
            {criticalItems.length > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {criticalItems.length}
              </span>
            ) : null}
          </div>
          <Link href="/panel/hasar-dosyalari?status=sla_exceeded" className="text-xs font-medium text-blue-600 hover:underline">
            Tümünü Gör
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : criticalItems.length === 0 ? (
          <p className="text-sm text-slate-500">Kritik uyarı görünmüyor.</p>
        ) : (
          <ul className="space-y-1.5">
            {criticalItems.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-1.5 text-xs sm:text-sm dark:border-red-900/40 dark:bg-red-950/20"
              >
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{item.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Finans Darboğazları</h3>
            {pendingPayments.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {pendingPayments.length}
              </span>
            ) : null}
          </div>
          <Link href="/panel/finans/tahsilatlar" className="text-xs font-medium text-blue-600 hover:underline">
            Detayları Gör
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : pendingPayments.length === 0 ? (
          <p className="text-sm text-slate-500">Bekleyen tahsilat görünmüyor.</p>
        ) : (
          <ul className="space-y-1.5">
            {pendingPayments.slice(0, 3).map((item) => (
              <li
                key={`${item.fileNo}-${item.insuranceCompany}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-xs sm:text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.fileNo}</span>
                <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Personel Yük Dağılımı</h3>
          </div>
          <Link href="/panel/personel-yonetimi" className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:underline">
            Tümünü Gör
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : staffItems.length === 0 ? (
          <p className="text-sm text-slate-500">Atama verisi yok.</p>
        ) : (
          <ul className="space-y-2">
            {staffItems.map((item) => {
              const widthPct = Math.round((item.activeFiles / maxFiles) * 100);
              return (
                <li key={item.userId}>
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.userName}</span>
                    <span className="shrink-0 text-[10px] text-slate-500 sm:text-xs">{item.activeFiles} dosya</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.criticalFiles > 0 ? 'bg-red-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.max(8, widthPct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
