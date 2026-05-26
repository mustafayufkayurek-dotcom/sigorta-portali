'use client';

import {
  FileText,
  Clock,
  AlertTriangle,
  BellRing,
  TrendingUp,
} from 'lucide-react';
import { WidgetBoundary } from '../widget-frame';
import { KpiCard } from './kpi-card';
import { useDashboardOperations, usePendingActions } from '../../hooks/use-dashboard-data';
import { formatCurrency } from '../../utils/formatters';

interface PrimaryKpiGroupProps {
  staggerIndex?: number;
  onNavigate?: (path: string) => void;
}

export function PrimaryKpiGroup({ staggerIndex = 0, onNavigate }: PrimaryKpiGroupProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();

  const ops = opsQuery.data;
  const pendingCount = pendingQuery.data?.items?.length ?? 0;
  const isLoading = opsQuery.isLoading || pendingQuery.isLoading || opsQuery.isFetching;
  const isError = opsQuery.isError;

  return (
    <WidgetBoundary>
      <section
        className={`grid grid-cols-2 gap-3 transition-all duration-500 ease-out lg:grid-cols-4 xl:grid-cols-5 ${
          isLoading ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      >
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))
        ) : isError ? (
          <div className="col-span-full rounded-xl border border-red-200/70 bg-red-50/80 px-4 py-5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            KPI verileri yüklenemedi.
            <button
              type="button"
              onClick={() => void opsQuery.refetch()}
              className="ml-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              Tekrar Dene
            </button>
          </div>
        ) : (
          <>
            <KpiCard
              icon={FileText}
              label="Toplam Dosya"
              value={ops?.totalClaims ?? '—'}
              color="bg-blue-600"
              emptyHint="Henüz kayıtlı dosya bulunmuyor."
              onClick={() => onNavigate?.('/panel/hasar-dosyalari')}
            />
            <KpiCard
              icon={Clock}
              label="Açık Dosya"
              value={ops?.openClaims ?? '—'}
              color="bg-indigo-600"
              subtext={ops ? `${ops.closedClaims} kapatıldı` : undefined}
              emptyHint="Takipte aktif dosya yok."
              onClick={() => onNavigate?.('/panel/hasar-dosyalari?status=open')}
            />
            <KpiCard
              icon={AlertTriangle}
              label="SLA Riski"
              value={ops?.slaViolationCount ?? '—'}
              color={ops && ops.slaViolationCount > 0 ? 'bg-red-600' : 'bg-emerald-600'}
              emptyHint="Riskte bekleyen SLA ihlali görünmüyor."
              onClick={() => onNavigate?.('/panel/hasar-dosyalari?status=sla_exceeded')}
            />
            <KpiCard
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingCount || '—'}
              color="bg-amber-600"
              emptyHint="Şu anda işlem bekleyen aksiyon bulunmuyor."
              onClick={() => onNavigate?.('/panel/hasar-dosyalari?status=open')}
            />
            <KpiCard
              icon={TrendingUp}
              label="Geciken Tahsilat"
              value={ops ? formatCurrency(ops.overdueCollectionAmount) : '—'}
              color="bg-rose-600"
              emptyHint="Gecikmiş tahsilat kaydı bulunmuyor."
              onClick={() => onNavigate?.('/panel/finans/tahsilatlar?paymentType=incoming&status=pending')}
            />
          </>
        )}
      </section>
    </WidgetBoundary>
  );
}
