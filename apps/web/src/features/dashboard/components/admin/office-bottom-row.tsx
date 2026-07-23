'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ClipboardList } from 'lucide-react';
import {
  useActivityFeed,
  useCriticalAlerts,
} from '../../hooks/use-dashboard-data';
import { usePendingOperations } from '../../hooks/use-pending-operations';
import { formatActivityAction } from '../../utils/format-activity-action';
import {
  CLAIM_LIST_HREF,
  CLAIM_LIST_SLA_HREF,
  claimNavHref,
} from '../../utils/claim-nav-href';
import { getRelativeTime } from '../../utils/formatters';
import { DashboardRowLink } from '../dashboard-row-link';
import { WidgetSkeleton } from '../widget-frame';

type OfficeBottomRowProps = {
  staggerIndex?: number;
};

/** Dosya sorumlusu özet bant: Kritik / Günlük Görevler / Son Aktivite */
export function OfficeBottomRow({ staggerIndex = 0 }: OfficeBottomRowProps) {
  const criticalQuery = useCriticalAlerts();
  const pendingOps = usePendingOperations();
  const activityQuery = useActivityFeed(12);

  const isLoading = criticalQuery.isLoading || pendingOps.isLoading || activityQuery.isLoading;

  const slaEscalations = criticalQuery.data?.slaEscalations ?? [];
  const inactiveFiles = criticalQuery.data?.inactiveFiles ?? [];
  const criticalItems = [
    ...slaEscalations.slice(0, 3).map((item) => ({
      key: `sla-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — SLA Aşımı`,
      meta: 'SLA Riski',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }),
    })),
    ...inactiveFiles.slice(0, 2).map((item) => ({
      key: `inactive-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — Hareketsiz`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} Gün` : '48 Sa+',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }),
    })),
  ].slice(0, 4);

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
            href={CLAIM_LIST_SLA_HREF}
            className="inline-flex min-h-[28px] items-center text-xs font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            {criticalItems.map((item) => {
              const inner = (
                <span className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                  <span className="shrink-0 text-xs text-slate-500">{item.meta}</span>
                </span>
              );
              return (
                <li key={item.key}>
                  {item.href ? (
                    <DashboardRowLink
                      href={item.href}
                      aria-label={`Kritik Uyarı: ${item.label}`}
                      className="block rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-1.5 hover:bg-red-100/70 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-900/30"
                    >
                      {inner}
                    </DashboardRowLink>
                  ) : (
                    <div className="rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-1.5 dark:border-red-900/40 dark:bg-red-950/20">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Günlük Görevler</h3>
            {pendingOps.view.summary.critical > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {pendingOps.view.summary.critical} kritik
              </span>
            ) : null}
          </div>
          <a
            href="#bekleyen-operasyonlar"
            className="inline-flex min-h-[28px] items-center text-xs font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Görev Merkezine Git
          </a>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={2} />
        ) : pendingOps.view.items.length === 0 ? (
          <p className="text-sm text-slate-500">Bugün aksiyon bekleyen görev yok.</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            İlk 5 kritik görev görev merkezinde. Tek tıkla operasyon aksiyonu alın.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Son Aktiviteler</h3>
          </div>
          <Link
            href={CLAIM_LIST_HREF}
            className="inline-flex min-h-[28px] items-center text-xs font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Dosyalara Git
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : activityItems.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz aktivite kaydı yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {activityItems.map((item, idx) => {
              const href = claimNavHref({ fileNo: item.fileNo });
              const inner = (
                <span className="flex items-start justify-between gap-2 text-xs sm:text-sm">
                  <span className="min-w-0">
                    <span className="block line-clamp-2 font-medium text-slate-800 dark:text-slate-100">
                      {formatActivityAction(item.action)}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400 sm:text-xs">{item.fileNo}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400 sm:text-xs">
                    {getRelativeTime(item.createdAt)}
                  </span>
                </span>
              );
              return (
                <li key={`${item.fileNo}-${item.createdAt}-${idx}`}>
                  {href ? (
                    <DashboardRowLink
                      href={href}
                      aria-label={`Aktivite Dosyasına Git: ${item.fileNo}`}
                      className="block rounded-lg border border-slate-100 px-2.5 py-1.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/80"
                    >
                      {inner}
                    </DashboardRowLink>
                  ) : (
                    <div className="rounded-lg border border-slate-100 px-2.5 py-1.5 dark:border-slate-800">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
