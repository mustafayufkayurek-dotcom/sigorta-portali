'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  BellRing,
  FileText,
  FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HASAR_OPERATION_ICON } from '@/constants/operation-icons';
import { WidgetBoundary } from '../widget-frame';
import { formatKpiPct } from '../kpi/strip-kpi';
import {
  useDailyFlow,
  useDashboardOperations,
  usePendingActions,
} from '../../hooks/use-dashboard-data';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';
import { OfficeSparkline } from './office-sparkline';

type OfficeKpiBandProps = {
  staggerIndex?: number;
};

type KpiCard = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
  href: string;
  color: string;
  sparkStroke: string;
  sparkline?: number[];
  trendLabel?: string;
};

/**
 * Dosya Sorumlusu FINAL KPI şeridi — 5 kart, gerçek API.
 * Admin/Yönetim KPI bileşenlerine dokunmaz.
 * Not: Haftalık iş yükü trendi kasıtlı ürün kararıyla gösterilir (Mustafa onayı).
 */
export function OfficeKpiBand({ staggerIndex = 0 }: OfficeKpiBandProps) {
  const opsQuery = useDashboardOperations();
  const pendingQuery = usePendingActions();
  const dailyQuery = useDailyFlow();

  const ops = opsQuery.data;
  const pendingItems = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const pendingCount = pendingItems.length;
  const density = dailyQuery.data?.teamDensity?.map((d) => d.count) ?? [];
  const isLoading =
    opsQuery.isLoading || pendingQuery.isLoading || opsQuery.isFetching;
  const opsFailed = opsQuery.isError;

  const total = ops?.totalOperationalFiles ?? 0;
  const openFiles = ops?.openOperationalFiles ?? 0;
  const hasar = ops?.totalClaims ?? 0;
  const sla = ops?.slaViolationCount ?? 0;

  const cards: KpiCard[] = [
    {
      key: 'total',
      icon: FileText,
      label: 'Toplam Operasyon',
      value: opsFailed ? '—' : total || '—',
      href: '/panel/hasar-dosyalari',
      color: 'bg-brand-600',
      sparkStroke: '#2563EB',
      sparkline: density.length ? density : undefined,
      trendLabel:
        ops && !opsFailed && total > 0
          ? `%${formatKpiPct(openFiles, total)} açık`
          : undefined,
    },
    {
      key: 'hasar',
      icon: HASAR_OPERATION_ICON,
      label: 'Hasar Dosyası',
      value: opsFailed ? '—' : hasar || '—',
      href: '/panel/hasar-dosyalari',
      color: 'bg-indigo-600',
      sparkStroke: '#4F46E5',
      trendLabel:
        ops && !opsFailed && total > 0 ? `%${formatKpiPct(hasar, total)} pay` : undefined,
    },
    {
      key: 'sla',
      icon: AlertTriangle,
      label: 'SLA (Hedef Süre)',
      value: opsFailed ? '—' : sla || '—',
      href: '/panel/raporlar/sla',
      color: sla > 0 ? 'bg-red-600' : 'bg-emerald-600',
      sparkStroke: sla > 0 ? '#DC2626' : '#059669',
      trendLabel:
        ops && !opsFailed && total > 0 ? `%${formatKpiPct(sla, total)} pay` : undefined,
    },
    {
      key: 'pending',
      icon: BellRing,
      label: 'Bekleyen Aksiyon',
      value: pendingQuery.isError ? '—' : pendingCount || '—',
      href: '/panel/hasar-dosyalari?status=open',
      color: 'bg-amber-600',
      sparkStroke: '#D97706',
      trendLabel:
        ops && !opsFailed && total > 0 ? `%${formatKpiPct(pendingCount, total)} pay` : undefined,
    },
    {
      key: 'open',
      icon: FolderOpen,
      label: 'Açık Dosya',
      value: opsFailed ? '—' : openFiles || '—',
      href: '/panel/hasar-dosyalari?status=open',
      color: 'bg-slate-700',
      sparkStroke: '#334155',
      sparkline: density.length ? density : undefined,
      trendLabel:
        ops && !opsFailed && total > 0 ? `%${formatKpiPct(openFiles, total)} pay` : undefined,
    },
  ];

  return (
    <section
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
      aria-label="Operasyon Özeti"
    >
      <WidgetBoundary>
        {opsFailed && pendingQuery.isError && !isLoading ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {formatWidgetErrorMessage(opsQuery.error, 'Operasyon özeti yüklenemedi.')}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[96px] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
                  />
                ))
              : cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.key}
                      href={card.href}
                      className="group flex min-h-[96px] min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex rounded-lg p-2 ${card.color}`}>
                          <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                        </span>
                        {card.sparkline ? (
                          <OfficeSparkline values={card.sparkline} stroke={card.sparkStroke} />
                        ) : null}
                      </div>
                      <div className="mt-2 min-w-0">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {card.label}
                        </p>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
                            {card.value}
                          </span>
                          {card.trendLabel ? (
                            <span className="truncate text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {card.trendLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </div>
        )}
      </WidgetBoundary>
    </section>
  );
}
