'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeSearchTR } from '@/utils/text-helpers';

export interface DistrictOption {
  id: string;
  name: string;
}

interface DistrictCheckboxGridProps {
  districts: DistrictOption[];
  isChecked: (districtId: string) => boolean;
  onToggle: (districtId: string) => void;
  loading?: boolean;
  maxHeightClass?: string;
  gridClassName?: string;
  accentClass?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function DistrictCheckboxGrid({
  districts,
  isChecked,
  onToggle,
  loading = false,
  maxHeightClass = 'max-h-40',
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5',
  accentClass = 'accent-indigo-600',
  searchPlaceholder = 'İlçe ara...',
  className = '',
}: DistrictCheckboxGridProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [districts]);

  const filtered = useMemo(() => {
    const q = normalizeSearchTR(query.trim());
    if (!q) return districts;
    return districts.filter((d) => normalizeSearchTR(d.name).includes(q));
  }, [districts, query]);

  if (loading) {
    return <p className="text-xs text-slate-400 py-2">İlçeler yükleniyor…</p>;
  }

  if (districts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="relative mb-2">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name="meridyen-district-grid-search"
          data-1p-ignore
          data-lpignore="true"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            aria-label="Aramayı temizle"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center bg-white rounded-lg border border-slate-100">
          &ldquo;{query}&rdquo; ile eşleşen ilçe bulunamadı
        </p>
      ) : (
        <div className={`${maxHeightClass} overflow-y-auto ${gridClassName} bg-white rounded-lg p-3 border border-slate-100`}>
          {filtered.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-indigo-600 rounded px-1 py-0.5 min-w-0"
            >
              <input
                type="checkbox"
                checked={isChecked(d.id)}
                onChange={() => onToggle(d.id)}
                className={`rounded flex-shrink-0 ${accentClass}`}
              />
              <span className="truncate" title={d.name}>{d.name}</span>
            </label>
          ))}
        </div>
      )}

      {query.trim() && filtered.length > 0 && filtered.length < districts.length && (
        <p className="text-[11px] text-slate-400 mt-1.5">
          {filtered.length} / {districts.length} ilçe gösteriliyor
        </p>
      )}
    </div>
  );
}
