'use client';

import Link from 'next/link';

export type DepartmentTab = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  departments: DepartmentTab[];
  selectedId: string | null;
  onSelect: (dept: DepartmentTab) => void;
  counts?: Record<string, number>;
  emptyHref?: string;
};

export function DepartmentTabSelector({
  departments,
  selectedId,
  onSelect,
  counts,
  emptyHref = '/panel/ayarlar/departmanlar',
}: Props) {
  if (departments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Henüz departman tanımlı değil.{' '}
        <Link href={emptyHref} className="text-blue-600 hover:underline font-medium">
          Departman oluşturun
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((d) => {
        const active = selectedId === d.id;
        const count = counts?.[d.id];
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors border ${
              active
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: d.color }}
            />
            {d.name}
            {count !== undefined && (
              <span className={`text-xs ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type ToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  hierarchyChild: string;
};

export function DepartmentDefinitionToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  hierarchyChild,
}: ToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative max-w-sm flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </div>
      <p className="text-xs text-slate-500 shrink-0">
        Hiyerarşi:{' '}
        <span className="font-medium text-slate-700">Departman</span>
        {' → '}
        <span className="font-medium text-slate-700">{hierarchyChild}</span>
      </p>
    </div>
  );
}

export function DepartmentContextBand({
  name,
  color,
  code,
  suffix = 'departmanına bağlanacak',
}: {
  name: string;
  color: string;
  code?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
      <p className="text-xs text-blue-800 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span>
          <span className="font-semibold">{name}</span>
          {' '}
          {suffix}
        </span>
      </p>
      {code && (
        <p className="text-[11px] text-blue-600/80 mt-0.5 font-mono pl-4">{code}</p>
      )}
    </div>
  );
}
