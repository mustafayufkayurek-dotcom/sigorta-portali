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
}

export function PrimaryKpiGroup({ staggerIndex = 0 }: PrimaryKpiGroupProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();

  const ops = opsQuery.data;
  const pendingItems = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const pendingCount = pendingItems.length;
  const isLoading = opsQuery.isLoading || pendingQuery.isLoading || opsQuery.isFetching;
  const isError = opsQuery.isError;

  return (
    <WidgetBoundary>
      <section
        className={`grid grid-cols-1 gap-3 transition-all duration-500 ease-out sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${
          isLoading ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      >
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
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
              label="Toplam Operasyon"
              value={ops?.totalOperationalFiles ?? ops?.totalClaims ?? '—'}
              color="bg-blue-600"
              subtext={ops ? `${ops.openOperationalFiles} açık takip` : undefined}
              emptyHint="Henüz kayıtlı operasyon dosyası bulunmuyor."
            />
            <KpiCard
              icon={Clock}
              label="Hasar Dosyası"
              value={ops?.totalClaims ?? '—'}
              color="bg-indigo-600"
              subtext={ops ? `${ops.openClaims} açık, ${ops.closedClaims} kapalı` : undefined}
              emptyHint="Kayıtlı hasar dosyası yok."
              href="/panel/hasar-dosyalari"
            />
            <KpiCard
              icon={BellRing}
              label="Acil Yardım"
              value={ops?.totalEmergencyCases ?? '—'}
              color="bg-cyan-600"
              subtext={ops ? `${ops.openEmergencyCases} açık, ${ops.closedEmergencyCases} kapalı` : undefined}
              emptyHint="Kayıtlı acil yardım dosyası yok."
              href="/panel/acil-yardim"
            />
            <KpiCard
              icon={AlertTriangle}
              label="SLA Riski"
              value={ops?.slaViolationCount ?? '—'}
              color={ops && ops.slaViolationCount > 0 ? 'bg-red-600' : 'bg-emerald-600'}
              emptyHint="Riskte bekleyen SLA ihlali görünmüyor."
              href={ops && ops.slaViolationCount > 0 ? '/panel/hasar-dosyalari?status=sla_exceeded' : undefined}
            />
            <KpiCard
              icon={BellRing}
              label="Bekleyen Aksiyon"
              value={pendingCount || '—'}
              color="bg-amber-600"
              emptyHint="Şu anda işlem bekleyen aksiyon bulunmuyor."
              href={pendingCount > 0 ? '/panel/hasar-dosyalari?status=open' : undefined}
            />
            <KpiCard
              icon={TrendingUp}
              label="Geciken Tahsilat"
              value={ops ? formatCurrency(ops.overdueCollectionAmount) : '—'}
              color="bg-rose-600"
              emptyHint="Gecikmiş tahsilat kaydı bulunmuyor."
              href="/panel/finans/tahsilatlar?paymentType=incoming&status=pending"
            />
          </>
        )}
      </section>
    </WidgetBoundary>
  );
}
