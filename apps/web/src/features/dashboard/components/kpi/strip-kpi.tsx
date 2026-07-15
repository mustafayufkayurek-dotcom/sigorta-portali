'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export type StripKpiProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  pct?: string;
  subtext?: string;
  color: string;
  href: string;
};

/** Tek reusable kompakt KPI — ~48px eşit yükseklik; 1440’te 6’lı satır */
export function StripKpi({ icon: Icon, label, value, pct, subtext, color, href }: StripKpiProps) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[48px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm transition hover:border-blue-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
    >
      <span className={`inline-flex shrink-0 rounded-md p-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-base font-bold leading-none text-slate-950 dark:text-white">{value}</span>
          {pct ? <span className="text-[10px] font-semibold text-slate-400">%{pct}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {subtext ? (
          <span className="block truncate text-[10px] text-slate-400">{subtext}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function formatKpiPct(part: number, total: number): string | undefined {
  if (!total || total <= 0) return undefined;
  return ((part / total) * 100).toFixed(1);
}
