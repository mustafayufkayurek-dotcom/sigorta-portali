'use client';

import {
  AlertTriangle,
  BellRing,
  FileText,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import { HASAR_OPERATION_ICON, ACIL_OPERATION_ICON } from '@/constants/operation-icons';
import { WidgetBoundary } from '../widget-frame';
import { useDashboardOperations, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';
import Link from 'next/link';

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

type AdminOperationsKpiBandProps = {
  staggerIndex?: number;
  hideAcil?: boolean;
};

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
      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3"
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white sm:text-base">Operasyon Özeti</h2>
      </div>

      <WidgetBoundary>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: hideAcil ? 5 : 6 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : opsFailed && pendingFailed ? (
          <div className="rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {formatWidgetErrorMessage(opsQuery.error, 'Operasyon özeti yüklenemedi.')}
          </div>
        ) : (
          <div className={`grid grid-cols-2 gap-1.5 sm:grid-cols-3 ${hideAcil ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
            <CompactKpiCard
              icon={FileText}
              label="Toplam Operasyon"
              value={opsFailed ? '—' : total || '—'}
              subtext="Tüm Zamanlar"
              color="bg-blue-600"
              href="/panel/hasar-dosyalari"
            />
            <CompactKpiCard
              icon={HASAR_OPERATION_ICON}
              label="Hasar"
              value={opsFailed ? '—' : (ops?.totalClaims ?? '—')}
              pct={ops && !opsFailed ? formatPct(ops.totalClaims, total) : undefined}
              color="bg-indigo-600"
              href="/panel/hasar-dosyalari"
            />
            {!hideAcil && (
              <CompactKpiCard
                icon={ACIL_OPERATION_ICON}
                label="Acil"
                value={opsFailed ? '—' : (ops?.totalEmergencyCases ?? '—')}
                pct={ops && !opsFailed ? formatPct(ops.totalEmergencyCases, total) : undefined}
                color="bg-cyan-600"
                href="/panel/acil-yardim"
              />
            )}
            <CompactKpiCard
              icon={AlertTriangle}
              label="SLA Riski"
              value={opsFailed ? '—' : (ops?.slaViolationCount ?? '—')}
              pct={ops && !opsFailed ? formatPct(ops.slaViolationCount, total) : undefined}
              color={ops && !opsFailed && ops.slaViolationCount > 0 ? 'bg-red-600' : 'bg-emerald-600'}
              href="/panel/raporlar/sla"
            />
            <CompactKpiCard
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingFailed ? '—' : (pendingCount || '—')}
              pct={ops && !opsFailed && total > 0 ? formatPct(pendingCount, total) : undefined}
              color="bg-amber-600"
              href="/panel/hasar-dosyalari?status=open"
            />
            <CompactKpiCard
              icon={FolderOpen}
              label="Açık Dosya"
              value={opsFailed ? '—' : (openFiles || '—')}
              pct={ops && !opsFailed ? formatPct(openFiles, total) : undefined}
              color="bg-slate-600"
              href="/panel/hasar-dosyalari?status=open"
            />
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
