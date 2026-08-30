'use client';

import type { ReactNode } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, Receipt, Hash, Scale, CalendarDays, Banknote } from 'lucide-react';

type ActionConfig = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'success' | 'neutral';
  active?: boolean;
  showPlus?: boolean;
};

const actionVariants = {
  primary: {
    idle: 'border border-brand-600 bg-brand-600 text-white hover:bg-brand-700',
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
  showPlus = true,
}: ActionConfig & { disabled?: boolean }) {
  const styles = actionVariants[variant][active ? 'active' : 'idle'];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {showPlus && !active && variant !== 'neutral' && <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-slate-100 bg-slate-50/80 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <h4 className="shrink-0 text-sm font-semibold text-slate-800">{title}</h4>
          {subtitle && (
            <span className="text-xs text-slate-500">{subtitle}</span>
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
  onSubmitAndNew,
  submitLabel = 'Kaydet',
  saving,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  onSubmitAndNew?: () => void;
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
        {onSubmitAndNew && (
          <button
            type="button"
            onClick={onSubmitAndNew}
            disabled={saving}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet ve Yeni'}
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center rounded-lg border border-brand-600 bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
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
      {required && (
        <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
      )}
    </label>
  );
}

const KPI_ICON: Record<string, typeof Wallet> = {
  'Toplam Gelir': TrendingUp,
  'Tahsil Edilen': Wallet,
  'Kalan Bakiye': Scale,
  'Gelen Tahsilat': TrendingUp,
  'Giden Ödeme': TrendingDown,
  'Kayıt Sayısı': Hash,
  'Toplam Masraf': Receipt,
  Bütçelenen: Receipt,
  'Ek İş': Banknote,
  Toplam: Scale,
  Kayıt: Hash,
  'Satış (Gelir)': TrendingUp,
  'Alış (Gider)': TrendingDown,
  Bekleyen: CalendarDays,
  'Fatura Sayısı': Receipt,
  'Beklenen Kâr': Banknote,
};

function kpiAccentForTone(accent: string | undefined, tone: 'dark' | 'light') {
  if (tone === 'light') {
    if (!accent || accent === 'text-white') return 'text-slate-800';
    return accent
      .replace('text-emerald-400', 'text-emerald-700')
      .replace('text-amber-400', 'text-amber-600')
      .replace('text-blue-400', 'text-blue-700')
      .replace('text-red-400', 'text-red-700')
      .replace('text-slate-400', 'text-slate-500');
  }
  return accent ?? 'text-white';
}

export function FinansMetricGrid({
  items,
}: {
  items: { label: string; value: string; accent?: string }[];
}) {
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`flex min-h-[4.75rem] flex-col items-center justify-center px-3 py-3 ${
              i < items.length - 1 ? 'border-r border-slate-100' : ''
            }`}
          >
            <p className="text-[11px] font-medium leading-none text-slate-500">{item.label}</p>
            <p
              className={`mt-1.5 text-base font-semibold tabular-nums tracking-tight leading-none ${
                item.accent ?? 'text-slate-800'
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinansKpiStrip({
  items,
  tone = 'dark',
}: {
  items: { label: string; value: string; accent?: string }[];
  /** Dosya üst özeti zaten koyu bantsa alt sekmelerde light kullanılır */
  tone?: 'dark' | 'light';
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={`mb-4 grid overflow-hidden rounded-xl shadow-sm ${
        dark
          ? 'border border-slate-700/60 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900'
          : 'border border-slate-200 bg-white'
      }`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => {
        const Icon = KPI_ICON[item.label] ?? Wallet;
        return (
          <div
            key={item.label}
            className={`flex items-center gap-3 px-3.5 py-3.5 ${
              i < items.length - 1 ? (dark ? 'border-r border-white/10' : 'border-r border-slate-100') : ''
            }`}
          >
            <span
              className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:inline-flex ${
                dark ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 text-left">
              <p
                className={`text-[10px] font-medium uppercase tracking-wide leading-none ${
                  dark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {item.label}
              </p>
              <p
                className={`mt-1.5 truncate text-base font-semibold tabular-nums leading-none ${kpiAccentForTone(
                  item.accent,
                  tone,
                )}`}
              >
                {item.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FinansFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-slate-500 border-b border-slate-100 pb-1.5">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export const finansFileInputClass =
  'w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:text-slate-700 file:font-medium file:text-xs hover:file:bg-slate-50';
