'use client';

import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

type ActionConfig = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'neutral';
  active?: boolean;
};

const actionVariants = {
  primary: {
    idle: 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
    active: 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
  },
  success: {
    idle: 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    active: 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
  },
  neutral: {
    idle: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    active: 'border border-slate-300 bg-slate-100 text-slate-700',
  },
};

export function FinansActionButton({
  label,
  onClick,
  variant = 'primary',
  active = false,
  disabled,
}: ActionConfig & { disabled?: boolean }) {
  const styles = actionVariants[variant][active ? 'active' : 'idle'];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {!active && variant !== 'neutral' && <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

export function FinansPanelCard({
  title,
  subtitle,
  action,
  children,
  noPadding,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ActionConfig;
  children: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {action && <FinansActionButton {...action} />}
      </div>
      <div className={noPadding ? undefined : 'p-4'}>{children}</div>
    </div>
  );
}

export function FinansEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">{description}</p>}
    </div>
  );
}

export function FinansFormPanel({
  title,
  children,
  onCancel,
  onSubmit,
  submitLabel = 'Kaydet',
  saving,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  saving?: boolean;
}) {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
        <FinansActionButton label="İptal" onClick={onCancel} variant="neutral" />
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center rounded-lg border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function FinansDataTable({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export const finansInputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export function FinansFieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export function FinansKpiStrip({
  items,
}: {
  items: { label: string; value: string; accent?: string }[];
}) {
  return (
    <div
      className="grid rounded-lg overflow-hidden border border-slate-200 mb-4 bg-slate-900"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-3 py-3 text-center ${i < items.length - 1 ? 'border-r border-slate-700/80' : ''}`}
        >
          <p className="text-[10px] font-medium text-slate-400 leading-none">{item.label}</p>
          <p
            className={`mt-1.5 text-base font-semibold tabular-nums leading-none ${
              item.accent ?? 'text-white'
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
