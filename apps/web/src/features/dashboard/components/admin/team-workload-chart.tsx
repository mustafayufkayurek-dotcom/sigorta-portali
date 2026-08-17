'use client';

import { useDailyFlow } from '../../hooks/use-dashboard-data';

type DensityPoint = { dayIndex: number; label: string; count: number };

type TeamWorkloadChartProps = {
  compact?: boolean;
  /** Parent zaten daily-flow çekiyorsa prop ver; yoksa hook kullanılır */
  density?: DensityPoint[];
  isLoading?: boolean;
};

export function TeamWorkloadChart({
  compact = false,
  density: densityProp,
  isLoading: loadingProp,
}: TeamWorkloadChartProps) {
  const query = useDailyFlow();
  const fromApi = densityProp ?? query.data?.teamDensity ?? [];
  const isLoading = loadingProp ?? (densityProp === undefined && query.isLoading);

  const counts = fromApi.map((d) => d.count);
  const max = Math.max(...counts, 1);
  const labels = fromApi.length === 7
    ? fromApi
    : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((label, dayIndex) => ({
        dayIndex,
        label,
        count: 0,
      }));

  if (isLoading) {
    return (
      <div className={`mt-1.5 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${compact ? 'h-10' : 'h-16'}`} />
    );
  }

  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Ekip Yoğunluğu</p>
      <div className={`mt-1 flex items-end justify-between gap-0.5 ${compact ? 'h-10' : 'h-16'}`}>
        {labels.map((item) => {
          const heightPct = Math.max(8, Math.round((item.count / max) * 100));
          const isToday =
            item.dayIndex === ((new Date().getDay() + 6) % 7);
          return (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div className={`flex w-full items-end justify-center ${compact ? 'h-8' : 'h-14'}`}>
                <div
                  className={`w-full max-w-[28px] rounded-t-md transition-all ${
                    isToday ? 'bg-brand-600' : 'bg-[#1e3a5f] dark:bg-brand-800'
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${item.label}: ${item.count} hareket`}
                />
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isToday ? 'text-brand-600 dark:text-blue-400' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
