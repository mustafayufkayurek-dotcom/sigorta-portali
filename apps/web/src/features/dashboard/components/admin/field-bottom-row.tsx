'use client';

import Link from 'next/link';
import { AlertTriangle, BellRing, FolderOpen } from 'lucide-react';
import {
  useFieldClaimSnapshots,
  useMyPerformance,
  usePendingActions,
} from '../../hooks/use-dashboard-data';
import { formatActivityAction } from '../../utils/format-activity-action';
import { WidgetSkeleton } from '../widget-frame';

type FieldBottomRowProps = {
  staggerIndex?: number;
};

/** Saha alt bant: SLA / Bekleyen / Açık Dosyalarım — finans yok; claim-files kapsamlı */
export function FieldBottomRow({ staggerIndex = 0 }: FieldBottomRowProps) {
  const claimsQuery = useFieldClaimSnapshots(30);
  const pendingQuery = usePendingActions();
  const perfQuery = useMyPerformance();

  const isLoading = claimsQuery.isLoading || pendingQuery.isLoading;

  const slaItems = claimsQuery.data?.slaItems ?? [];
  const slaTotal = perfQuery.data?.slaViolations ?? claimsQuery.data?.slaTotal ?? slaItems.length;
  const openItems = claimsQuery.data?.openItems ?? [];
  const openTotal = perfQuery.data?.openFiles ?? claimsQuery.data?.openTotal ?? openItems.length;
  const pendingItems = (pendingQuery.data?.items ?? []).slice(0, 4);

  return (
    <section
      className="grid grid-cols-1 gap-2 lg:grid-cols-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">SLA Riskleri</h3>
            {slaTotal > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {slaTotal}
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
        ) : slaItems.length === 0 ? (
          <p className="text-sm text-slate-500">SLA aşımı görünmüyor.</p>
        ) : (
          <ul className="space-y-1.5">
            {slaItems.map((item) => (
              <li
                key={item.id || item.fileNo}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-1.5 text-xs sm:text-sm dark:border-red-900/40 dark:bg-red-950/20"
              >
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {item.fileNo ?? 'Dosya'}
                </span>
                <span className="shrink-0 truncate text-xs text-slate-500 max-w-[45%]">
                  {item.currentStatus?.name ?? 'SLA Aşımı'}
                </span>
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
                <span className="shrink-0 truncate text-xs text-slate-500 max-w-[45%]">
                  {formatActivityAction(item.action)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Açık Dosyalarım</h3>
            {openTotal > 0 ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                {openTotal}
              </span>
            ) : null}
          </div>
          <Link href="/panel/hasar-dosyalari?status=open" className="text-xs font-medium text-blue-600 hover:underline">
            Dosyalara Git
          </Link>
        </div>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : openItems.length === 0 ? (
          <p className="text-sm text-slate-500">Açık atanan dosya yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {openItems.map((item) => (
              <li
                key={item.id || item.fileNo}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs sm:text-sm dark:border-slate-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                    {item.fileNo ?? 'Dosya'}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400 sm:text-xs">
                    {item.currentStatus?.name ?? 'Açık'}
                  </span>
                </span>
                {item.id ? (
                  <Link
                    href={`/panel/hasar-dosyalari/${item.id}`}
                    className="shrink-0 text-[10px] font-medium text-blue-600 hover:underline sm:text-xs"
                  >
                    Aç
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
