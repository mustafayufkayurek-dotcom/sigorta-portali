'use client';

import {
  AlertTriangle,
  BellRing,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import { WidgetBoundary } from '../widget-frame';
import { StripKpi, formatKpiPct } from '../kpi/strip-kpi';
import { useDashboardOperations, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';

type AdminOperationsKpiBandProps = {
  staggerIndex?: number;
  hideAcil?: boolean;
};

/** C2 — KPI kompakt şerit (tek StripKpi; 6’lı tek satır 1440) */
export function AdminOperationsKpiBand({ staggerIndex = 0, hideAcil = false }: AdminOperationsKpiBandProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();

  const ops = opsQuery.data;
  const pendingItems = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const pendingCount = pendingItems.length;
  const isLoading = opsQuery.isLoading || pendingQuery.isLoading || opsQuery.isFetching;
  const opsFailed = opsQuery.isError;
  const pendingFailed = pendingQuery.isError;

  const total = ops?.totalOperationalFiles ?? 0;
  const openFiles = ops?.openOperationalFiles ?? 0;

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Operasyon Özeti"
    >
      <WidgetBoundary>
        {isLoading ? (
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${hideAcil ? 'xl:grid-cols-5' : 'xl:grid-cols-6'}`}>
            {Array.from({ length: hideAcil ? 5 : 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : opsFailed && pendingFailed ? (
          <div className="rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(opsQuery.error, 'Operasyon özeti yüklenemedi.')}
          </div>
        ) : (
          <div
            className={`grid auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-3 ${
              hideAcil ? 'xl:grid-cols-5' : 'xl:grid-cols-6'
            }`}
          >
            <StripKpi
              icon={FileText}
              label="Toplam Operasyon"
              value={opsFailed ? '—' : total || '—'}
              color="bg-blue-600"
              href="/panel/hasar-dosyalari"
            />
            <StripKpi
              icon={HASAR_OPERATION_ICON}
              label="Hasar"
              value={opsFailed ? '—' : (ops?.totalClaims ?? '—')}
              pct={ops && !opsFailed ? formatKpiPct(ops.totalClaims, total) : undefined}
              color="bg-indigo-600"
              href="/panel/hasar-dosyalari"
            />
            {!hideAcil && (
              <StripKpi
                icon={ACIL_OPERATION_ICON}
                label="Acil"
                value={opsFailed ? '—' : (ops?.totalEmergencyCases ?? '—')}
                pct={ops && !opsFailed ? formatKpiPct(ops.totalEmergencyCases, total) : undefined}
                color="bg-cyan-600"
                href="/panel/acil-yardim"
              />
            )}
            <StripKpi
              icon={AlertTriangle}
              label="SLA Riski"
              value={opsFailed ? '—' : (ops?.slaViolationCount ?? '—')}
              pct={ops && !opsFailed ? formatKpiPct(ops.slaViolationCount, total) : undefined}
              color={ops && !opsFailed && ops.slaViolationCount > 0 ? 'bg-red-600' : 'bg-emerald-600'}
              href="/panel/raporlar/sla"
            />
            <StripKpi
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingFailed ? '—' : (pendingCount || '—')}
              pct={ops && !opsFailed && total > 0 ? formatKpiPct(pendingCount, total) : undefined}
              color="bg-amber-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <StripKpi
              icon={FolderOpen}
              label="Açık Dosya"
              value={opsFailed ? '—' : (openFiles || '—')}
              pct={ops && !opsFailed ? formatKpiPct(openFiles, total) : undefined}
              color="bg-slate-600"
              href="/panel/hasar-dosyalari?status=open"
            />
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
