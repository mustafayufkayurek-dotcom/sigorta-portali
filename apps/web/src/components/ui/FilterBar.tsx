'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type FilterOption = {
  value: string;
  label: string;
};

type FilterConfig = {
  id: string;
  label: string;
  type: 'select' | 'date' | 'text';
  options?: FilterOption[];
};

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onReset: () => void;
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between md:hidden">
        <h3 className="text-sm font-semibold text-slate-700">Filtreler</h3>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Gizle' : 'Göster'}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className={`${open ? 'grid' : 'hidden'} gap-3 md:grid md:grid-cols-2 lg:grid-cols-4`}>
        {filters.map((filter) => {
          const value = values[filter.id] ?? '';

          return (
            <label key={filter.id} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">{filter.label}</span>
              {filter.type === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => onChange(filter.id, e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Tümü</option>
                  {(filter.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={filter.type}
                  value={value}
                  onChange={(e) => onChange(filter.id, e.target.value)}
                  placeholder={filter.type === 'text' ? `${filter.label}...` : undefined}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              )}
            </label>
          );
        })}
      </div>

      <div className={`${open ? 'mt-3 flex' : 'hidden'} justify-end md:mt-4 md:flex`}>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filtreleri Sifirla
        </button>
      </div>
    </div>
  );
}