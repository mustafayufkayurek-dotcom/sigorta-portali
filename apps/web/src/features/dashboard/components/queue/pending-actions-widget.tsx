'use client';

import { BellRing, Shield } from 'lucide-react';
import { usePendingActions } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';
import { StatusBadge } from '@/components/ui';
import { getDaysAgo } from '../../utils/formatters';
import { formatActivityAction } from '../../utils/format-activity-action';
import { claimNavHref } from '../../utils/claim-nav-href';
import { DashboardRowLink } from '../dashboard-row-link';

interface PendingActionsWidgetProps {
  staggerIndex?: number;
}

export function PendingActionsWidget({ staggerIndex = 0 }: PendingActionsWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePendingActions();
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <WidgetShell
      title="Bekleyen Aksiyonlar"
      icon={<BellRing className="h-5 w-5 text-status-warning" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={formatWidgetErrorMessage(error, 'Bekleyen aksiyonlar yüklenemedi.')}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={4} />
      ) : !items.length ? (
        <WidgetEmpty
          icon={Shield}
          message="Henüz bekleyen aksiyon yok. Yeni hasar dosyası oluşturun →"
          actionLabel="Hasar dosyaları"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((item) => {
            const href = claimNavHref({ id: item.id, fileNo: item.fileNo });
            const actionLabel = formatActivityAction(item.action);
            const body = (
              <span className="grid w-full grid-cols-1 gap-2 md:grid-cols-4">
                <span className="font-semibold text-slate-900 dark:text-white">{item.fileNo}</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{actionLabel}</span>
                <span className="text-sm text-slate-500">{getDaysAgo(item.pendingSince)} gün bekliyor</span>
                <StatusBadge
                  label={item.priority || 'normal'}
                  variant={
                    item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'
                  }
                  size="sm"
                />
              </span>
            );
            const shellClass =
              'block rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-left hover:bg-amber-100/70 dark:border-amber-900/30 dark:bg-amber-950/20 dark:hover:bg-amber-900/30';

            if (!href) {
              return (
                <div key={item.id || `${item.fileNo}-${item.action}`} className={shellClass}>
                  {body}
                </div>
              );
            }

            return (
              <DashboardRowLink
                key={item.id || `${item.fileNo}-${item.action}`}
                href={href}
                aria-label={`Dosyaya Git: ${item.fileNo}`}
                className={shellClass}
              >
                {body}
              </DashboardRowLink>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
