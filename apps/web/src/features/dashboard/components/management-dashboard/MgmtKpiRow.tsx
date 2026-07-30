'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MGMT } from './mgmt-theme';

export type MgmtKpiItem = {
  id: string;
  title: string;
  value: string;
  trendLabel?: string | null;
  /** Hover / erişilebilirlik — tam dönem açıklaması */
  trendTitle?: string | null;
  trendDirection?: 'up' | 'down' | 'flat' | null;
  icon: LucideIcon;
  iconClass: string;
};

export function MgmtKpiRow({ items, loading }: { items: MgmtKpiItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-[#E2E8F0] bg-white"
            style={{ height: MGMT.kpiH, boxShadow: MGMT.shadow }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        const TrendIcon =
          item.trendDirection === 'up'
            ? TrendingUp
            : item.trendDirection === 'down'
              ? TrendingDown
              : Minus;
        const trendColor =
          item.trendDirection === 'up'
            ? 'text-[#16A34A]'
            : item.trendDirection === 'down'
              ? 'text-[#EF4444]'
              : 'text-slate-400';
        return (
          <div
            key={item.id}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white px-3 pb-3 pt-2.5 transition duration-200 hover:z-10 hover:border-slate-300 hover:shadow-md"
            style={{ height: MGMT.kpiH, boxShadow: MGMT.shadow }}
          >
            <span
              className={`absolute right-2.5 top-2.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-110 ${item.iconClass}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
              <p className="w-full text-[12px] font-medium leading-tight text-[#64748B]">{item.title}</p>
              <p className="w-full text-[20px] font-bold leading-none tracking-tight text-[#0F172A]">
                {item.value}
              </p>
              <p
                className={`inline-flex max-w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold ${trendColor}`}
                title={item.trendTitle || item.trendLabel || undefined}
              >
                <TrendIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.trendLabel || '—'}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
