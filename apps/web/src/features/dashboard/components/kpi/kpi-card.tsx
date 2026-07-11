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
  compact?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KpiCard({ icon: Icon, label, value, color, subtext, emptyHint, href, onClick, compact = false, trend }: KpiCardProps) {
  const isZeroValue = typeof value === 'number' ? value === 0 : value === '0' || value === '₺0';
  const isInteractive = Boolean(href || onClick);
  const className = `group min-h-0 w-full rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 ${
    compact
      ? 'p-2 sm:min-h-0 sm:rounded-lg sm:p-2'
      : 'p-2.5 sm:min-h-[104px] sm:rounded-lg sm:p-4 lg:min-h-[116px]'
  } ${isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40' : ''}`;

  const content = (
      <div className={`flex h-full flex-col ${compact ? 'gap-1 sm:flex-row sm:items-center sm:gap-2' : 'gap-1.5 sm:flex-row sm:items-center sm:gap-3'}`}>
        <div className={`inline-flex w-fit rounded-md ${compact ? 'p-1' : 'p-1.5 sm:p-2'} ${color}`}>
          <Icon className={`text-white ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-5 sm:w-5'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <p className={`font-bold leading-none text-slate-900 dark:text-white ${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'}`}>{value}</p>
            {trend && (
              <span
                className={`text-[10px] font-medium sm:text-xs ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <p className={`mt-0.5 font-medium leading-tight text-slate-500 dark:text-slate-400 ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}>{label}</p>
          {subtext && <p className={`text-slate-400 dark:text-slate-500 ${compact ? 'text-[10px]' : 'hidden text-xs sm:block'}`}>{subtext}</p>}
          {isZeroValue && emptyHint && (
            <p className={`mt-0.5 font-medium text-slate-400 dark:text-slate-500 ${compact ? 'hidden' : 'hidden text-[11px] sm:block'}`}>
              {emptyHint}
              {isInteractive && ' Liste için tıklayın.'}
            </p>
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
