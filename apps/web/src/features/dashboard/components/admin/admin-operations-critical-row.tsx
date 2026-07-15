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
      key: `sla-${item.fileNo}`,
      label: `${item.fileNo} — SLA Aşımı`,
      meta: 'SLA Riski',
    })),
    ...inactiveFiles.slice(0, 3).map((item) => ({
      key: `inactive-${item.fileNo}`,
      label: `${item.fileNo} — Hareketsiz`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} Gün` : '48 Sa+',
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
      key: `near-${item.fileNo}`,
      label: item.fileNo,
      meta: 'Kritik',
      tone: 'critical' as const,
    })),
    ...(slaWarning > 0
      ? [
          {
            key: 'sla-warn-sum',
            label: `${slaWarning} Dosya Uyarı Bandında`,
            meta: 'Yaklaşan',
            tone: 'warn' as const,
          },
        ]
      : []),
  ].slice(0, 4);

  const criticalOps = criticalItems.slice(0, 3);

  return (
    <section
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] xl:gap-5"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      {/* Operasyon paneli — içerik yüksekliği; min-height zorlaması yok */}
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <h3 className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white">Operasyon</h3>
          <Link
            href="/panel/operasyon"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Operasyon Merkezi
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <WidgetSkeleton rows={8} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
                  {pendingActions.map((item) => (
                    <li
                      key={item.id}
                      className="truncate rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5 text-xs font-medium text-slate-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-slate-100"
                    >
                      {item.fileNo} — {formatActivityAction(item.action)}
                    </li>
                  ))}
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
                  {slaApproaching.map((item) => (
                    <li
                      key={item.key}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs dark:bg-orange-950/20 ${
                        item.tone === 'critical'
                          ? 'border-red-100 bg-red-50/50 dark:border-red-900/40'
                          : 'border-orange-100 bg-orange-50/60 dark:border-orange-900/40'
                      }`}
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{item.meta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Son Atamalar */}
            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex h-5 items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                  Son Atamalar
                </div>
                <Link href="/panel/personel-yonetimi" className="text-[10px] font-medium text-blue-600 hover:underline">
                  Tümü
                </Link>
              </div>
              {staffItems.length === 0 ? (
                <p className="text-xs text-slate-500">Atama verisi yok.</p>
              ) : (
                <ul className="space-y-1">
                  {staffItems.map((item) => (
                    <li
                      key={item.userId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.userName}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {item.activeFiles} Dosya
                        {item.criticalFiles > 0 ? ` · ${item.criticalFiles} Kritik` : ''}
                      </span>
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
                  {criticalOps.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/50 px-2 py-1.5 text-xs dark:border-red-900/40 dark:bg-red-950/20"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{item.meta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Son Aktiviteler — 2 kolon geniş */}
            <div className="flex min-h-0 flex-col sm:col-span-2">
              <div className="mb-1 flex h-5 items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <Activity className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
                Son Aktiviteler
              </div>
              {activityItems.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz aktivite yok.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {activityItems.map((item, idx) => (
                    <li
                      key={`${item.fileNo}-${item.createdAt}-${idx}`}
                      className="rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {item.fileNo} — {formatActivityAction(item.action)}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{relativeShort(item.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        {item.userName}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kritik Uyarılar — içerik yüksekliği; stretch ile hizalı */}
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
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
            href="/panel/hasar-dosyalari?status=sla_exceeded"
            className="text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Tümünü Gör
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={5} />
        ) : criticalItems.length === 0 ? (
          <p className="text-sm text-slate-500">Kritik uyarı görünmüyor.</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5">
            {criticalItems.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-2 text-xs sm:text-sm dark:border-red-900/40 dark:bg-red-950/20"
              >
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{item.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
