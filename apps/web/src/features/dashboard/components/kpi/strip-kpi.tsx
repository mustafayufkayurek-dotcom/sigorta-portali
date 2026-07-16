'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export type StripKpiTrend = {
  /** Yüzde değişim; null = karşılaştırma yok */
  pct: number | null;
  /** true = artış olumlu (ciro/kâr); false = artış olumsuz (gider) */
  positiveIsGood?: boolean;
};

export type StripKpiProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  pct?: string;
  subtext?: string;
  color: string;
  href: string;
  /** Önceki dönem karşılaştırması + ok */
  trend?: StripKpiTrend;
};

/** Tek reusable kompakt KPI — ~48px eşit yükseklik; 1440’te şerit satır */
export function StripKpi({
  icon: Icon,
  label,
  value,
  pct,
  subtext,
  color,
  href,
  trend,
}: StripKpiProps) {
  const trendPct = trend?.pct;
  const hasTrend = trendPct != null && Number.isFinite(trendPct);
  const isUp = hasTrend && trendPct > 0;
  const isDown = hasTrend && trendPct < 0;
  const positiveIsGood = trend?.positiveIsGood !== false;
  const trendGood = hasTrend
    ? isUp
      ? positiveIsGood
      : isDown
        ? !positiveIsGood
        : true
    : true;
  const trendClass = !hasTrend
    ? 'text-slate-400'
    : Math.abs(trendPct) < 0.05
      ? 'text-slate-400'
      : trendGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

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
          {hasTrend ? (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${trendClass}`}>
              {isUp ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              ) : isDown ? (
                <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Minus className="h-3 w-3" aria-hidden="true" />
              )}
              {Math.abs(trendPct).toFixed(1)}%
            </span>
          ) : null}
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

/** Önceki döneme göre % değişim; önceki 0 ve şimdi >0 → 100 */
export function computeChangePct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
