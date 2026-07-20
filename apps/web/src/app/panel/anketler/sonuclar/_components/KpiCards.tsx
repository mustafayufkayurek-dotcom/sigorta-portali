'use client';

import {
  FileText,
  Percent,
  Star,
  Activity,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react';
import type { KpiCardModel } from '../_lib/survey-results-types';

const TONE: Record<KpiCardModel['iconTone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
};

const ICONS = {
  total: FileText,
  participation: Users,
  rate: Percent,
  score: Star,
  nps: Activity,
} as const;

function TrendBadge({ trend }: { trend: KpiCardModel['trend'] }) {
  if (!trend) return <span className="text-[11px] text-slate-400">—</span>;
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'up'
      ? 'text-emerald-600'
      : trend.direction === 'down'
        ? 'text-rose-600'
        : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      %{trend.percent.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
    </span>
  );
}

export function KpiCards({ items }: { items: KpiCardModel[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
      {items.map((item) => {
        const Icon = ICONS[item.id as keyof typeof ICONS] || FileText;
        return (
          <div
            key={item.id}
            className="flex min-h-[108px] flex-col rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  {item.title}
                  {item.infoTooltip ? (
                    <span className="group relative inline-flex">
                      <Info className="h-3 w-3 cursor-help text-slate-400" aria-hidden />
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-52 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-normal leading-snug text-slate-600 shadow-lg group-hover:block">
                        {item.infoTooltip}
                      </span>
                      <span className="sr-only">{item.infoTooltip}</span>
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                {item.subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-400">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[item.iconTone]}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-auto pt-2">
              <TrendBadge trend={item.trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
