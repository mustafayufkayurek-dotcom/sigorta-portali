'use client';

import { RotateCcw } from 'lucide-react';
import type { ReferenceFilters, ReferenceOperationCategory } from '@/components/portal/operation-reference.types';
import { REFERENCE_CATEGORY_META } from '@/components/portal/operation-reference.types';

type OperationReferenceFiltersProps = {
  filters: ReferenceFilters;
  cityOptions: string[];
  onChange: (next: ReferenceFilters) => void;
  onClear: () => void;
};

const CATEGORY_OPTIONS: { value: ReferenceOperationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tüm Kategoriler' },
  ...Object.entries(REFERENCE_CATEGORY_META).map(([value, meta]) => ({
    value: value as ReferenceOperationCategory,
    label: meta.shortLabel,
  })),
];

export default function OperationReferenceFilters({
  filters,
  cityOptions,
  onChange,
  onClear,
}: OperationReferenceFiltersProps) {
  const selectClass =
    'h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-[180px]';

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <select
        aria-label="Kategori filtresi"
        className={selectClass}
        value={filters.category}
        onChange={(e) =>
          onChange({ ...filters, category: e.target.value as ReferenceFilters['category'] })
        }
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        aria-label="İl filtresi"
        className={selectClass}
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value })}
      >
        <option value="all">Tüm İller</option>
        {cityOptions.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      <input
        type="date"
        aria-label="Başlangıç tarihi"
        className={selectClass}
        value={filters.dateFrom}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        placeholder="Tarih Aralığı"
      />

      <input
        type="date"
        aria-label="Bitiş tarihi"
        className={selectClass}
        value={filters.dateTo}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
      />

      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-600 transition hover:bg-blue-50"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Filtreleri Temizle
      </button>
    </div>
  );
}
