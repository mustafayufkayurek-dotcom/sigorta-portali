'use client';

import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  FileText,
  FolderOpen,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { WidgetBoundary } from '../widget-frame';
import { useMyPerformance, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type CompactKpiProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  pct?: string;
  subtext?: string;
  color: string;
  href: string;
};

function CompactKpiCard({ icon: Icon, label, value, pct, subtext, color, href }: CompactKpiProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[72px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className={`inline-flex rounded-lg p-1 ${color}`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </span>
        {pct ? (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">%{pct}</span>
        ) : null}
      </div>
      <div>
        <p className="text-lg font-bold leading-none text-slate-950 dark:text-white">{value}</p>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {subtext ? <p className="mt-0.5 text-[10px] text-slate-400">{subtext}</p> : null}
      </div>
    </Link>
  );
}

function formatPct(part: number, total: number): string | undefined {
  if (!total || total <= 0) return undefined;
  return ((part / total) * 100).toFixed(1);
}

type FieldOperationsKpiBandProps = {
  staggerIndex?: number;
};

/** Saha: atanan dosya KPI — finans yok; my-performance + bekleyen aksiyon */
export function FieldOperationsKpiBand({ staggerIndex = 0 }: FieldOperationsKpiBandProps) {
  const perfQuery = useMyPerformance();
  const pendingQuery = usePendingActions();

  const perf = perfQuery.data;
  const pendingCount = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items.length : 0;
  const isLoading = perfQuery.isLoading || pendingQuery.isLoading || perfQuery.isFetching;
  const perfFailed = perfQuery.isError;
  const pendingFailed = pendingQuery.isError;

  const total = perf?.totalFiles ?? 0;
  const openFiles = perf?.openFiles ?? 0;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Saha Özeti</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
          Size atanan dosyalar, SLA ve bekleyen aksiyonlar
        </p>
      </div>

      <WidgetBoundary>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : perfFailed && pendingFailed ? (
          <div className="rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(perfQuery.error, 'Saha özeti yüklenemedi.')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            <CompactKpiCard
              icon={FileText}
              label="Atanan Dosya"
              value={perfFailed ? '—' : total || '—'}
              subtext="Tüm Zamanlar"
              color="bg-blue-600"
              href="/panel/hasar-dosyalari"
            />
            <CompactKpiCard
              icon={FolderOpen}
              label="Açık Dosya"
              value={perfFailed ? '—' : openFiles || '—'}
              pct={perf && !perfFailed ? formatPct(openFiles, total) : undefined}
              color="bg-slate-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <CompactKpiCard
              icon={AlertTriangle}
              label="SLA Riski"
              value={perfFailed ? '—' : (perf?.slaViolations ?? '—')}
              pct={perf && !perfFailed ? formatPct(perf.slaViolations, total) : undefined}
              color={
                perf && !perfFailed && perf.slaViolations > 0 ? 'bg-red-600' : 'bg-emerald-600'
              }
              href="/panel/hasar-dosyalari?status=sla_exceeded"
            />
            <CompactKpiCard
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingFailed ? '—' : pendingCount || '—'}
              pct={perf && !perfFailed && total > 0 ? formatPct(pendingCount, total) : undefined}
              color="bg-amber-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <CompactKpiCard
              icon={CalendarCheck}
              label="Bu Ay Kapanan"
              value={perfFailed ? '—' : (perf?.thisMonthClosed ?? '—')}
              subtext="Ay İçi"
              color="bg-indigo-600"
              href="/panel/hasar-dosyalari?status=closed"
            />
            <CompactKpiCard
              icon={Gauge}
              label="Kapasite"
              value={perfFailed ? '—' : perf ? `%${perf.capacityUsageRate}` : '—'}
              subtext={
                perf && !perfFailed
                  ? `SLA Uyum %${perf.slaComplianceRate}`
                  : 'Yük Oranı'
              }
              color="bg-cyan-600"
              href="/panel/hasar-dosyalari"
            />
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
