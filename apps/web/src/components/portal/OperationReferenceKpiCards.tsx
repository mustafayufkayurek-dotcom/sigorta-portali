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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {REFERENCE_KPI_CARDS.map((card) => {
        const palette = KPI_ICON_COLORS[card.icon] ?? KPI_ICON_COLORS.residential;
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${palette.bg} ${palette.text}`}
              >
                <KpiIcon icon={card.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-tight text-slate-500">{card.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900">
                  {formatReferenceKpiValue(value)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

