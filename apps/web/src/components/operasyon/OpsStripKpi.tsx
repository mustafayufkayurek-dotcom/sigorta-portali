'use client';

import type { LucideIcon } from 'lucide-react';

export function OpsStripKpi({
  label,
  value,
  color,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <div
      className={`group flex h-[102px] w-full min-w-0 flex-row items-center gap-3 overflow-hidden rounded-xl border bg-white px-2.5 py-2.5 shadow-md transition ${
        active
          ? 'border-blue-400 ring-2 ring-blue-200 shadow-blue-100'
          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 hover:shadow-lg'
      }`}
      data-testid="ops-kpi-card"
      data-kpi-label={label}
    >
      <span className={`inline-flex w-fit shrink-0 rounded-lg p-2 shadow-sm ${color}`}>
        <Icon className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xl font-bold leading-none tabular-nums text-slate-950">{value}</span>
        <span className="mt-1.5 block text-[10px] font-semibold leading-snug text-slate-600 [overflow-wrap:anywhere]">
          {label}
        </span>
      </span>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full min-w-0 text-left" data-testid={`ops-kpi-${label}`}>
        {body}
      </button>
    );
  }
  return body;
}
