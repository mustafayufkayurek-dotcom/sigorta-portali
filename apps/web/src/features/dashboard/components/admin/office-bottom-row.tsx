'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, Clock } from 'lucide-react';
import {
  useActivityFeed,
  useApprovalDelays,
  useCriticalAlerts,
} from '../../hooks/use-dashboard-data';
import { formatActivityAction } from '../../utils/format-activity-action';
import {
  CLAIM_LIST_HREF,
  CLAIM_LIST_SLA_HREF,
  claimNavHref,
} from '../../utils/claim-nav-href';
import { getRelativeTime } from '../../utils/formatters';
import { DashboardRowLink } from '../dashboard-row-link';
import { WidgetSkeleton } from '../widget-frame';
import { repairReportStatusLabel } from '@/utils/repair-report-status';

type OfficeBottomRowProps = {
  staggerIndex?: number;
};

function formatWaitingLabel(hours: number) {
  if (hours >= 48) return `${Math.round(hours / 24)} Gün`;
  return `${hours} Saat`;
}

/**
 * FINAL alt satır: Kritik Uyarılar | Son Aktiviteler | Onay Gecikmeleri
 * Yönetim / Admin layout’a mount edilmez.
 */
export function OfficeBottomRow({ staggerIndex = 0 }: OfficeBottomRowProps) {
  const criticalQuery = useCriticalAlerts();
  const activityQuery = useActivityFeed(12);
  const approvalQuery = useApprovalDelays();

  const isLoading =
    criticalQuery.isLoading || activityQuery.isLoading || approvalQuery.isLoading;

  const slaEscalations = criticalQuery.data?.slaEscalations ?? [];
  const inactiveFiles = criticalQuery.data?.inactiveFiles ?? [];
  const criticalItems = [
    ...slaEscalations.slice(0, 3).map((item) => ({
      key: `sla-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — Hedef Süre Aşmak Üzere`,
      meta: 'SLA (Hedef Süre)',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }) ?? CLAIM_LIST_SLA_HREF,
    })),
    ...inactiveFiles.slice(0, 2).map((item) => ({
      key: `inactive-${item.id ?? item.fileNo}`,
      label: `${item.fileNo} — Evrak / Hareket Eksik`,
      meta: item.daysSinceActivity != null ? `${item.daysSinceActivity} Gün` : '48 Sa+',
      href: claimNavHref({ id: item.id, fileNo: item.fileNo }) ?? CLAIM_LIST_HREF,
    })),
  ].slice(0, 4);

  const activityItems = (activityQuery.data?.items ?? []).slice(0, 5);
  const approvalItems = (approvalQuery.data?.items ?? []).slice(0, 5);

  return (
    <section
      className="grid grid-cols-1 gap-3 lg:grid-cols-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Operasyon Listeleri"
    >
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-danger" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Kritik Uyarılar</h3>
            {criticalItems.length > 0 ? (
              <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {criticalItems.length}
              </span>
            ) : null}
          </div>
          <Link
            href={CLAIM_LIST_SLA_HREF}
            className="text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Tüm Uyarıları Gör →
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : criticalItems.length === 0 ? (
          <p className="text-sm text-slate-500">Kritik uyarı görünmüyor.</p>
        ) : (
          <ul className="space-y-2">
            {criticalItems.map((item) => (
              <li key={item.key}>
                <DashboardRowLink
                  href={item.href}
                  aria-label={item.label}
                  className="flex items-start justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-2 transition hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                >
                  <span className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-red-700 dark:text-red-300">
                    {item.meta}
                  </span>
                </DashboardRowLink>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Son Aktiviteler</h3>
          </div>
          <Link
            href={CLAIM_LIST_HREF}
            className="text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Tüm Aktiviteler →
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : activityItems.length === 0 ? (
          <p className="text-sm text-slate-500">Son aktivite görünmüyor.</p>
        ) : (
          <ul className="space-y-2">
            {activityItems.map((item, index) => (
              <li key={`${item.fileNo}-${item.createdAt}-${index}`}>
                <DashboardRowLink
                  href={claimNavHref({ fileNo: item.fileNo }) ?? CLAIM_LIST_HREF}
                  aria-label={`${formatActivityAction(item.action)} ${item.fileNo}`}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                      {formatActivityAction(item.action)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {item.fileNo}
                      {item.description ? ` · ${item.description}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {getRelativeTime(item.createdAt)}
                  </span>
                </DashboardRowLink>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Onay Gecikmeleri</h3>
          </div>
          <Link
            href="/panel/hasar-dosyalari?repairReportStatus=pending_approval"
            className="text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Tümünü Gör →
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : approvalItems.length === 0 ? (
          <p className="text-sm text-slate-500">Geciken onay görünmüyor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                  <th className="pb-2 pr-2 font-medium">Dosya No</th>
                  <th className="pb-2 pr-2 font-medium">Gecikme Süresi</th>
                  <th className="pb-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {approvalItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="py-2 pr-2">
                      <Link
                        href={claimNavHref({ id: item.id, fileNo: item.fileNo }) ?? CLAIM_LIST_HREF}
                        className="font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {item.fileNo}
                      </Link>
                    </td>
                    <td
                      className={`py-2 pr-2 font-semibold tabular-nums ${
                        item.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {formatWaitingLabel(item.hoursWaiting)}
                    </td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">
                      {repairReportStatusLabel(item.status) || 'Onay Bekliyor'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link
          href="/panel/hasar-dosyalari?repairReportStatus=pending_approval"
          className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Tüm Gecikmeleri Gör →
        </Link>
      </article>
    </section>
  );
}
