'use client';

import { Activity, Inbox } from 'lucide-react';
import { useActivityFeed } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { getRelativeTime } from '../../utils/formatters';
import { formatActivityAction } from '../../utils/format-activity-action';

interface ActivityFeedWidgetProps {
  onNavigate?: (path: string) => void;
  staggerIndex?: number;
}

export function ActivityFeedWidget({ onNavigate, staggerIndex = 0 }: ActivityFeedWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useActivityFeed(20);
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <WidgetShell
      title="Son Aktiviteler"
      icon={<Activity className="h-5 w-5 text-blue-500" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'Aktivite akışı yüklenemedi.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={5} />
      ) : !items.length ? (
        <WidgetEmpty
          icon={Inbox}
          message="Henüz aktivite kaydı yok."
        />
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((item, idx) => (
            <button
              key={`${item.fileNo}-${item.createdAt}-${idx}`}
              type="button"
              onClick={() => onNavigate?.(`/panel/hasar-dosyalari?search=${encodeURIComponent(item.fileNo)}`)}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatActivityAction(item.action)}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">{getRelativeTime(item.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {item.fileNo} · {item.userName}
                </p>
                {item.description && <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
