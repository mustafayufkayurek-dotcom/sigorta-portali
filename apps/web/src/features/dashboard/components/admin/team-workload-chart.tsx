'use client';

import { useMemo } from 'react';
import { useActivityFeed } from '../../hooks/use-dashboard-data';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function TeamWorkloadChart() {
  const { data, isLoading } = useActivityFeed(120);
  const items = Array.isArray(data?.items) ? data.items : [];

  const { counts, max } = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const dayCounts = new Array(7).fill(0) as number[];
    for (const item of items) {
      if (!item.createdAt) continue;
      const created = new Date(item.createdAt);
      if (created < weekStart) continue;
      const dayIdx = (created.getDay() + 6) % 7;
      dayCounts[dayIdx] += 1;
    }

    const peak = Math.max(...dayCounts, 1);
    return { counts: dayCounts, max: peak };
  }, [items]);

  if (isLoading) {
    return (
      <div className="mt-2 h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    );
  }

  return (
    <div className="mt-2">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">Ekip Yoğunluğu</p>
      <div className="mt-1.5 flex h-16 items-end justify-between gap-1">
        {DAY_LABELS.map((label, idx) => {
          const value = counts[idx];
          const heightPct = Math.max(8, Math.round((value / max) * 100));
          return (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div className="flex h-14 w-full items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-t-md bg-[#1e3a5f] transition-all dark:bg-blue-800"
                  style={{ height: `${heightPct}%` }}
                  title={`${label}: ${value} hareket`}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-500">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
