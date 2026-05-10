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
            onClick={() => onNavigate?.('/panel/hasar-dosyalari?filter=sla_exceeded')}
            className="rounded-lg bg-white/10 p-4 text-left transition-colors hover:bg-white/20"
          >
            <p className="text-4xl font-bold">{data.slaEscalations?.length ?? 0}</p>
            <p className="mt-1 text-sm font-medium">SLA Aşan Dosyalar</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/panel/hasar-dosyalari?filter=inactive')}
            className="rounded-lg bg-white/10 p-4 text-left transition-colors hover:bg-white/20"
          >
            <p className="text-4xl font-bold">{data.inactiveFiles?.length ?? 0}</p>
            <p className="mt-1 text-sm font-medium">Hareketsiz Dosyalar (48h+)</p>
          </button>
        </div>
      )}
    </WidgetShell>
  );
}
