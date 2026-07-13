'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, BellRing } from 'lucide-react';
import {
  useActivityFeed,
  useCriticalAlerts,
  usePendingActions,
} from '../../hooks/use-dashboard-data';
import { getRelativeTime } from '../../utils/formatters';
import { WidgetSkeleton } from '../widget-frame';

type OfficeBottomRowProps = {
  staggerIndex?: number;
};

/** Dosya sorumlusu alt bant: Kritik / Bekleyen / Son Aktivite — finans yok */
export function OfficeBottomRow({ staggerIndex = 0 }: OfficeBottomRowProps) {
  const criticalQuery = useCriticalAlerts();
  const pendingQuery = usePendingActions();
  const activityQuery = useActivityFeed(12);

  const isLoading = criticalQuery.isLoading || pendingQuery.isLoading || activityQuery.isLoading;

  const slaEscalations = criticalQuery.data?.slaEscalations ?? [];
  const inactiveFiles = criticalQuery.data?.inactiveFiles ?? [];
  const criticalItems = [
    ...slaEscalations.slice(0, 3).map((item) => ({
      key: `sla-${item.fileNo}`,
      label: `${item.fileNo} — SLA Aşımı`,
      meta: 'SLA Riski',
    })),
    ...inactiveFiles.slice(0, 2).map((item) => ({
      key: `inactive-${item.fileNo}`,
      label: `${item.fileNo} — Hareketsiz`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} Gün` : '48 Sa+',
    })),
  ].slice(0, 4);

  const pendingItems = (pendingQuery.data?.items ?? []).slice(0, 4);
  const activityItems = (activityQuery.data?.items ?? []).slice(0, 4);

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
          <Link
            href="/panel/hasar-dosyalari?status=sla_exceeded"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
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
            <BellRing className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Bekleyen Aksiyonlar</h3>
            {pendingItems.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {pendingItems.length}
              </span>
            ) : null}
          </div>
          <Link href="/panel/hasar-dosyalari?status=open" className="text-xs font-medium text-blue-600 hover:underline">
            Tümünü Gör
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : pendingItems.length === 0 ? (
          <p className="text-sm text-slate-500">Bekleyen aksiyon yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {pendingItems.map((item) => (
              <li
                key={item.id || `${item.fileNo}-${item.action}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-xs sm:text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.fileNo}</span>
                <span className="shrink-0 truncate text-xs text-slate-500 max-w-[45%]">{item.action}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Son Aktiviteler</h3>
          </div>
          <Link href="/panel/hasar-dosyalari" className="text-xs font-medium text-blue-600 hover:underline">
            Dosyalara Git
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : activityItems.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz aktivite kaydı yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {activityItems.map((item, idx) => (
              <li
                key={`${item.fileNo}-${item.createdAt}-${idx}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs sm:text-sm dark:border-slate-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                    {item.action}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400 sm:text-xs">{item.fileNo}</span>
                </span>
                <span className="shrink-0 text-[10px] text-slate-400 sm:text-xs">
                  {getRelativeTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
