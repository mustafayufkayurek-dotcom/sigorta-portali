'use client';

import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  FileText,
  FolderOpen,
  Gauge,
} from 'lucide-react';
import { WidgetBoundary } from '../widget-frame';
import { StripKpi, formatKpiPct } from '../kpi/strip-kpi';
import { useMyPerformance, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type FieldOperationsKpiBandProps = {
  staggerIndex?: number;
};

/** Saha: atanan dosya KPI — tek StripKpi */
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
      className="rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Saha Özeti"
    >
      <WidgetBoundary>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : perfFailed && pendingFailed ? (
          <div className="rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(perfQuery.error, 'Saha özeti yüklenemedi.')}
          </div>
        ) : (
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <StripKpi
              icon={FileText}
              label="Atanan Dosya"
              value={perfFailed ? '—' : total || '—'}
              subtext="Tüm Zamanlar"
              color="bg-brand-600"
              href="/panel/hasar-dosyalari"
            />
            <StripKpi
              icon={FolderOpen}
              label="Açık Dosya"
              value={perfFailed ? '—' : openFiles || '—'}
              pct={perf && !perfFailed ? formatKpiPct(openFiles, total) : undefined}
              color="bg-slate-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <StripKpi
              icon={AlertTriangle}
              label="SLA Riski"
              value={perfFailed ? '—' : (perf?.slaViolations ?? '—')}
              pct={perf && !perfFailed ? formatKpiPct(perf.slaViolations, total) : undefined}
              color={
                perf && !perfFailed && perf.slaViolations > 0 ? 'bg-red-600' : 'bg-emerald-600'
              }
              href="/panel/hasar-dosyalari?status=sla_exceeded"
            />
            <StripKpi
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingFailed ? '—' : pendingCount || '—'}
              pct={perf && !perfFailed && total > 0 ? formatKpiPct(pendingCount, total) : undefined}
              color="bg-amber-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <StripKpi
              icon={CalendarCheck}
              label="Bu Ay Kapanan"
              value={perfFailed ? '—' : (perf?.thisMonthClosed ?? '—')}
              subtext="Ay İçi"
              color="bg-indigo-600"
              href="/panel/hasar-dosyalari?status=closed"
            />
            <StripKpi
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
