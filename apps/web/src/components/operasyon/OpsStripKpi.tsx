'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Az kartı sayfa enine germeden, sağda delik bırakmadan tek şerit. */
export function OpsKpiSegmentBand({
  children,
  testId,
}: {
  children: ReactNode;
  testId: string;
}) {
  return (
    <div
      className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function OpsStripKpi({
  label,
  value,
  color,
  icon: Icon,
  onClick,
  active,
  dense = false,
  embedded = false,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  dense?: boolean;
  /** Tek şerit dilimi — ayrı kart gibi gerilmez. Hasar listesi bunu kullanmaz. */
  embedded?: boolean;
}) {
  const body = (
    <div
      className={
        embedded
          ? `group relative flex h-[72px] w-full min-w-0 items-center justify-center gap-3 overflow-hidden px-4 py-2 transition ${
              active ? 'bg-blue-50/80' : 'hover:bg-slate-50/80'
            }`
          : `group relative flex w-full min-w-0 flex-row items-center overflow-hidden rounded-xl border bg-white shadow-card transition ${
              dense ? 'h-[64px] gap-2 py-2 pl-3 pr-2' : 'h-[102px] gap-3 py-2.5 pl-4 pr-2.5 rounded-2xl'
            } ${
              active
                ? 'border-blue-400 ring-2 ring-blue-200 shadow-blue-100'
                : 'border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md'
            }`
      }
      data-testid="ops-kpi-card"
      data-kpi-label={label}
      data-kpi-embedded={embedded ? '1' : undefined}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${color}`} aria-hidden />
      <span className={`inline-flex w-fit shrink-0 rounded-lg shadow-sm ${color} ${dense || embedded ? 'p-1.5' : 'p-2'}`}>
        <Icon className={dense || embedded ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white'} strokeWidth={2.25} aria-hidden />
      </span>
      <span className={embedded ? 'min-w-0 text-left' : 'min-w-0 flex-1 text-left'}>
        <span className={`block font-bold leading-none tabular-nums text-slate-950 ${dense || embedded ? 'text-lg' : 'text-xl'}`}>{value}</span>
        <span className={`mt-0.5 block font-semibold leading-snug text-slate-600 [overflow-wrap:anywhere] ${dense || embedded ? 'text-[10px]' : 'text-[10px] mt-1.5'}`}>
          {label}
        </span>
      </span>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full w-full min-w-0 text-left" data-testid={`ops-kpi-${label}`}>
        {body}
      </button>
    );
  }
  return body;
}
