'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Clock,
  ListChecks,
  UserPlus,
} from 'lucide-react';
import {
  useActivityFeed,
  useCriticalAlerts,
  useOwnershipLoad,
  usePendingActions,
  useSlaSummary,
} from '../../hooks/use-dashboard-data';
import { formatActivityAction } from '../../utils/format-activity-action';
import {
  CLAIM_LIST_HREF,
  CLAIM_LIST_SLA_HREF,
  OPERATIONS_CENTER_HREF,
  STAFF_MGMT_HREF,
  claimNavHref,
  staffLoadHref,
} from '../../utils/claim-nav-href';
import { DashboardRowLink } from '../dashboard-row-link';
import { WidgetSkeleton } from '../widget-frame';

type AdminOperationsCriticalRowProps = {
  staggerIndex?: number;
};

function relativeShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Şimdi';
  if (mins < 60) return `${mins} Dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} Sa`;
  return `${Math.floor(hours / 24)} Gün`;
}

/**
 * C3 — Operasyon (55%) | Kritik Uyarılar (45%)
 * Operasyon boşluğu: Bekleyen / SLA / Atamalar / Kritik ops / Aktivite
 */
export function AdminOperationsCriticalRow({ staggerIndex = 0 }: AdminOperationsCriticalRowProps) {
  const criticalQuery = useCriticalAlerts();
  const ownershipQuery = useOwnershipLoad();
  const pendingQuery = usePendingActions();
  const slaQuery = useSlaSummary();
  const activityQuery = useActivityFeed(8);

  const isLoading =
    criticalQuery.isLoading ||
    ownershipQuery.isLoading ||
    pendingQuery.isLoading ||
    slaQuery.isLoading ||
    activityQuery.isLoading;

  const slaEscalations = criticalQuery.data?.slaEscalations ?? [];
  const inactiveFiles = criticalQuery.data?.inactiveFiles ?? [];
  const criticalItems = [
    ...slaEscalations.slice(0, 4).map((item) => ({
      key: `sla-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — SLA Aşımı`,
      meta: 'SLA Riski',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }),
    })),
    ...inactiveFiles.slice(0, 3).map((item) => ({
      key: `inactive-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — Hareketsiz`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} Gün` : '48 Sa+',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }),
    })),
  ].slice(0, 6);

  const pendingActions = (pendingQuery.data?.items ?? []).slice(0, 4);
  const staffItems = (ownershipQuery.data?.items ?? []).slice(0, 4);
  const activityItems = (activityQuery.data?.items ?? []).slice(0, 4);

  const slaByStatus = slaQuery.data?.byStatus ?? [];
  const slaWarning = slaByStatus.reduce((sum, s) => sum + (s.warning ?? 0), 0);
  const slaCritical = slaByStatus.reduce((sum, s) => sum + (s.critical ?? 0) + (s.escalated ?? 0), 0);
  const slaApproaching = [
    ...slaEscalations.slice(0, 3).map((item) => ({
      key: `near-${item.id ?? item.fileNo}`,
      label: item.fileNo,
      meta: 'Kritik',
      tone: 'critical' as const,
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }),
    })),
    ...(slaWarning > 0
      ? [
          {
            key: 'sla-warn-sum',
            label: `${slaWarning} Dosya Uyarı Bandında`,
            meta: 'Yaklaşan',
            tone: 'warn' as const,
            href: CLAIM_LIST_SLA_HREF,
          },
        ]
      : []),
  ].slice(0, 4);

  const criticalOps = criticalItems.slice(0, 3);

  return (
    <section
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] xl:gap-5"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      {/* Operasyon paneli — içerik yüksekliği; equal-height zorlaması yok */}
      <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <h3 className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white">Operasyon</h3>
          <Link
            href={OPERATIONS_CENTER_HREF}
            className="inline-flex min-h-[28px] items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Operasyon Merkezi
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <WidgetSkeleton rows={8} />
        ) : (
          <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Bekleyen İşler */}
            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex h-5 items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                Bekleyen İşler
              </div>
              {pendingActions.length === 0 ? (
                <p className="text-xs text-slate-500">Bekleyen işlem yok.</p>
              ) : (
                <ul className="space-y-1">
                  {pendingActions.map((item) => {
                    const href = claimNavHref({ id: item.id, fileNo: item.fileNo });
                    const label = `${item.fileNo} — ${formatActivityAction(item.action)}`;
                    const body = (
                      <span className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-100">
                        {label}
                      </span>
                    );
                    return (
                      <li key={item.id || `${item.fileNo}-${item.action}`}>
                        {href ? (
                          <DashboardRowLink
                            href={href}
                            aria-label={`Dosyaya Git: ${item.fileNo}`}
                            className="block rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5 hover:bg-amber-100/80 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-900/30"
                          >
                            {body}
                          </DashboardRowLink>
                        ) : (
                          <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Yaklaşan SLA */}
            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex h-5 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />
                  Yaklaşan SLA
                </div>
                {(slaWarning > 0 || slaCritical > 0) && (
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                    {slaCritical + slaWarning}
                  </span>
                )}
              </div>
              {slaApproaching.length === 0 ? (
                <p className="text-xs text-slate-500">Yaklaşan SLA yok.</p>
              ) : (
                <ul className="space-y-1">
                  {slaApproaching.map((item) => {
                    const inner = (
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{item.meta}</span>
                      </span>
                    );
                    const baseTone =
                      item.tone === 'critical'
                        ? 'border-red-100 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20'
                        : 'border-orange-100 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20';
                    const hoverTone =
                      item.tone === 'critical'
                        ? 'hover:bg-red-100/70 dark:hover:bg-red-900/30'
                        : 'hover:bg-orange-100/70 dark:hover:bg-orange-900/30';
                    return (
                      <li key={item.key}>
                        {item.href ? (
                          <DashboardRowLink
                            href={item.href}
                            aria-label={`SLA Dosyasına Git: ${item.label}`}
                            className={`block rounded-lg border px-2 py-1.5 ${baseTone} ${hoverTone}`}
                          >
                            {inner}
                          </DashboardRowLink>
                        ) : (
                          <div className={`rounded-lg border px-2 py-1.5 ${baseTone}`}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Son Atamalar — satır hedefi yok; yalnızca Tümü navigasyonu */}
            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex h-5 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                  Son Atamalar
                </div>
                <Link
                  href={STAFF_MGMT_HREF}
                  className="inline-flex min-h-[28px] items-center text-[10px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Tümü
                </Link>
              </div>
              {staffItems.length === 0 ? (
                <p className="text-xs text-slate-500">Atama verisi yok.</p>
              ) : (
                <ul className="space-y-1">
                  {staffItems.map((item) => (
                    <li key={item.userId}>
                      <DashboardRowLink
                        href={staffLoadHref(item.userId)}
                        aria-label={`Personel Yükü: ${item.userName}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                      >
                        <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{item.userName}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {item.activeFiles} Dosya
                          {item.criticalFiles > 0 ? ` · ${item.criticalFiles} Kritik` : ''}
                        </span>
                      </DashboardRowLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Kritik Operasyonlar */}
            <div className="flex min-h-0 flex-col sm:col-span-1">
              <div className="mb-1 flex h-5 items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
                Kritik Operasyonlar
              </div>
              {criticalOps.length === 0 ? (
                <p className="text-xs text-slate-500">Kritik operasyon yok.</p>
              ) : (
                <ul className="space-y-1">
                  {criticalOps.map((item) => {
                    const inner = (
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{item.meta}</span>
                      </span>
                    );
                    return (
                      <li key={item.key}>
                        {item.href ? (
                          <DashboardRowLink
                            href={item.href}
                            aria-label={`Kritik Operasyon: ${item.label}`}
                            className="block rounded-lg border border-red-100 bg-red-50/50 px-2 py-1.5 hover:bg-red-100/70 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-900/30"
                          >
                            {inner}
                          </DashboardRowLink>
                        ) : (
                          <div className="rounded-lg border border-red-100 bg-red-50/50 px-2 py-1.5 dark:border-red-900/40 dark:bg-red-950/20">
                            {inner}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Son Aktiviteler — 2 kolon; kontrollü 2 satır line-clamp */}
            <div className="flex min-h-0 flex-col sm:col-span-2">
              <div className="mb-1 flex h-5 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <Activity className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
                  Son Aktiviteler
                </div>
                <Link
                  href={CLAIM_LIST_HREF}
                  className="inline-flex min-h-[28px] items-center text-[10px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Dosyalara Git
                </Link>
              </div>
              {activityItems.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz aktivite yok.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {activityItems.map((item, idx) => {
                    const href = claimNavHref({ fileNo: item.fileNo });
                    const title = `${item.fileNo} — ${formatActivityAction(item.action)}`;
                    const body = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{title}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{relativeShort(item.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                          {item.userName}
                          {item.description ? ` · ${item.description}` : ''}
                        </p>
                      </>
                    );
                    return (
                      <li key={`${item.fileNo}-${item.createdAt}-${idx}`}>
                        {href ? (
                          <DashboardRowLink
                            href={href}
                            aria-label={`Aktivite Dosyasına Git: ${item.fileNo}`}
                            className="block rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/80"
                          >
                            {body}
                          </DashboardRowLink>
                        ) : (
                          <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kritik Uyarılar — içerikle büyür; stretch equal-height yok */}
      <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white">Kritik Uyarılar</h3>
            {criticalItems.length > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {criticalItems.length}
              </span>
            ) : null}
          </div>
          <Link
            href={CLAIM_LIST_SLA_HREF}
            className="inline-flex min-h-[28px] items-center text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Tümünü Gör
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={5} />
        ) : criticalItems.length === 0 ? (
          <p className="text-sm text-slate-500">Kritik uyarı görünmüyor.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
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
                      className="block rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-2 hover:bg-red-100/70 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-900/30"
                    >
                      {inner}
                    </DashboardRowLink>
                  ) : (
                    <div className="rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-2 dark:border-red-900/40 dark:bg-red-950/20">
                      {inner}
                    </div>
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
