'use client';

import { BellRing, Shield } from 'lucide-react';
import { usePendingActions } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { StatusBadge } from '@/components/ui';
import { getDaysAgo } from '../../utils/formatters';

interface PendingActionsWidgetProps {
  onNavigate?: (path: string) => void;
  staggerIndex?: number;
}

export function PendingActionsWidget({ onNavigate, staggerIndex = 0 }: PendingActionsWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePendingActions();

  return (
    <WidgetShell
      title="Bekleyen Aksiyonlar"
      icon={<BellRing className="h-5 w-5 text-amber-500" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'Bekleyen aksiyonlar yüklenemedi.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={4} />
      ) : !data?.items?.length ? (
        <WidgetEmpty
          icon={Shield}
          message="Henüz bekleyen aksiyon yok. Yeni hasar dosyası oluşturun →"
          actionLabel="Hasar dosyaları"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-2">
          {data.items.slice(0, 8).map((item) => (
            <button
              key={item.id || `${item.fileNo}-${item.action}`}
              type="button"
              onClick={() => onNavigate?.(`/panel/hasar-dosyalari?search=${encodeURIComponent(item.fileNo)}`)}
              className="grid w-full grid-cols-1 gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-left transition-colors hover:bg-amber-100/70 dark:border-amber-900/30 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 md:grid-cols-4"
            >
              <span className="font-semibold text-slate-900 dark:text-white">{item.fileNo}</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{item.action}</span>
              <span className="text-sm text-slate-500">{getDaysAgo(item.pendingSince)} gün bekliyor</span>
              <StatusBadge
                label={item.priority || 'normal'}
                variant={
                  item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'
                }
                size="sm"
              />
            </button>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
