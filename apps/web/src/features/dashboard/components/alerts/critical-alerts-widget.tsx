'use client';

import { useCriticalAlerts } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { ShieldAlert } from 'lucide-react';

interface CriticalAlertsWidgetProps {
  onNavigate?: (path: string) => void;
  staggerIndex?: number;
}

export function CriticalAlertsWidget({ onNavigate, staggerIndex = 0 }: CriticalAlertsWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useCriticalAlerts();

  return (
    <WidgetShell
      title="Kritik Uyarılar"
      variant="alert"
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'Kritik uyarılar alınamadı.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={2} className="min-h-[172px]" />
      ) : !data || data.totalCritical === 0 ? (
        <WidgetEmpty icon={ShieldAlert} message="Eşik aşımı veya hareketsiz dosya tespit edilmedi." />
      ) : (
        <div className="grid min-h-[172px] grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onNavigate?.('/panel/hasar-dosyalari?status=sla_exceeded')}
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-left transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-950/40"
          >
            <p className="text-4xl font-bold text-red-700 dark:text-red-300">{data.slaEscalations?.length ?? 0}</p>
            <p className="mt-1 text-sm font-medium text-red-900 dark:text-red-100">SLA Aşan Dosyalar</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/panel/hasar-dosyalari?status=open')}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
          >
            <p className="text-4xl font-bold text-amber-700 dark:text-amber-300">{data.inactiveFiles?.length ?? 0}</p>
            <p className="mt-1 text-sm font-medium text-amber-900 dark:text-amber-100">Hareketsiz Dosyalar (48 saat üzeri)</p>
          </button>
        </div>
      )}
    </WidgetShell>
  );
}
