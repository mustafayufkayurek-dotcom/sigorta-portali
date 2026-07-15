'use client';

import { Activity, Inbox } from 'lucide-react';
import { useActivityFeed } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { getRelativeTime } from '../../utils/formatters';
import { formatActivityAction } from '../../utils/format-activity-action';
import { claimNavHref } from '../../utils/claim-nav-href';
import { DashboardRowLink } from '../dashboard-row-link';

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
          {items.slice(0, 10).map((item, idx) => {
            const href = claimNavHref({ fileNo: item.fileNo });
            const body = (
              <>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                      {formatActivityAction(item.action)}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">{getRelativeTime(item.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {item.fileNo} · {item.userName}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{item.description}</p>
                  ) : null}
                </div>
              </>
            );

            // Hedef yoksa tıklanabilir görünmesin
            if (!href) {
              return (
                <div
                  key={`${item.fileNo}-${item.createdAt}-${idx}`}
                  className="flex w-full items-start gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                >
                  {body}
                </div>
              );
            }

            // Legacy onNavigate varsa onu kullan; yoksa gerçek Link
            if (onNavigate) {
              return (
                <button
                  key={`${item.fileNo}-${item.createdAt}-${idx}`}
                  type="button"
                  onClick={() => onNavigate(href)}
                  aria-label={`Aktivite Dosyasına Git: ${item.fileNo}`}
                  className="flex min-h-[36px] w-full cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  {body}
                </button>
              );
            }

            return (
              <DashboardRowLink
                key={`${item.fileNo}-${item.createdAt}-${idx}`}
                href={href}
                aria-label={`Aktivite Dosyasına Git: ${item.fileNo}`}
                className="flex w-full items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
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
