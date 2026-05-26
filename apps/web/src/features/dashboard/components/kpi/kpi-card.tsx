'use client';

import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  subtext?: string;
  emptyHint?: string;
  onClick?: () => void;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KpiCard({ icon: Icon, label, value, color, subtext, emptyHint, onClick, trend }: KpiCardProps) {
  const isZeroValue = typeof value === 'number' ? value === 0 : value === '0' || value === '₺0';
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group min-h-[116px] w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 ${onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            {trend && (
              <span
                className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          {subtext && <p className="text-xs text-slate-400 dark:text-slate-500">{subtext}</p>}
          {isZeroValue && emptyHint && (
            <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">{emptyHint}</p>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
