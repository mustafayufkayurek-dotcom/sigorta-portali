'use client';

import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  subtext?: string;
  emptyHint?: string;
  href?: string;
  onClick?: () => void;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KpiCard({ icon: Icon, label, value, color, subtext, emptyHint, href, onClick, trend }: KpiCardProps) {
  const isZeroValue = typeof value === 'number' ? value === 0 : value === '0' || value === '₺0';
  const isInteractive = Boolean(href || onClick);
  const className = `group min-h-0 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:min-h-[104px] sm:rounded-lg sm:p-4 lg:min-h-[116px] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 ${isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40' : ''}`;

  const content = (
      <div className="flex h-full flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <div className={`inline-flex w-fit rounded-md p-1.5 sm:p-2 ${color}`}>
          <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <p className="text-lg font-bold leading-none text-slate-900 dark:text-white sm:text-2xl">{value}</p>
            {trend && (
              <span
                className={`text-[10px] font-medium sm:text-xs ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400 sm:text-xs">{label}</p>
          {subtext && <p className="hidden text-xs text-slate-400 dark:text-slate-500 sm:block">{subtext}</p>}
          {isZeroValue && emptyHint && (
            <p className="mt-0.5 hidden text-[11px] font-medium text-slate-400 dark:text-slate-500 sm:block">{emptyHint}</p>
          )}
        </div>
      </div>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
