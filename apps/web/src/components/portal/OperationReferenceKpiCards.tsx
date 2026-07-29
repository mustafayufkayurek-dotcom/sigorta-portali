'use client';

import {
  REFERENCE_KPI_CARDS,
  type ReferenceKpiStats,
  type ReferenceOperationCategory,
} from '@/components/portal/operation-reference.types';
import { formatReferenceKpiValue } from '@/utils/operation-reference-utils';
import {
  Factory,
  Flame,
  Home,
  Landmark,
  MapPin,
  Ship,
} from 'lucide-react';

const KPI_ICON_COLORS: Record<string, { bg: string; text: string }> = {
  residential: { bg: 'bg-blue-50', text: 'text-brand-600' },
  industrial: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  public_critical: { bg: 'bg-violet-50', text: 'text-violet-600' },
  maritime: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  disaster: { bg: 'bg-orange-50', text: 'text-orange-600' },
  servedProvinces: { bg: 'bg-sky-50', text: 'text-sky-700' },
};

function KpiIcon({ icon }: { icon: ReferenceOperationCategory | 'servedProvinces' }) {
  const cls = 'h-4 w-4';
  switch (icon) {
    case 'residential':
      return <Home className={cls} aria-hidden="true" />;
    case 'industrial':
      return <Factory className={cls} aria-hidden="true" />;
    case 'public_critical':
      return <Landmark className={cls} aria-hidden="true" />;
    case 'maritime':
      return <Ship className={cls} aria-hidden="true" />;
    case 'disaster':
      return <Flame className={cls} aria-hidden="true" />;
    default:
      return <MapPin className={cls} aria-hidden="true" />;
  }
}

type OperationReferenceKpiCardsProps = {
  stats: ReferenceKpiStats;
};

export default function OperationReferenceKpiCards({ stats }: OperationReferenceKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {REFERENCE_KPI_CARDS.map((card) => {
        const palette = KPI_ICON_COLORS[card.icon] ?? KPI_ICON_COLORS.residential;
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className="group relative flex min-h-[4.75rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-2 shadow-sm"
          >
            <span
              className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${palette.bg} ${palette.text}`}
              aria-hidden
            >
              <KpiIcon icon={card.icon} />
            </span>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="w-full text-[11px] font-medium leading-tight text-slate-500">{card.label}</p>
              <p className="w-full text-lg font-bold tabular-nums leading-none tracking-tight text-slate-900">
                {formatReferenceKpiValue(value)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
