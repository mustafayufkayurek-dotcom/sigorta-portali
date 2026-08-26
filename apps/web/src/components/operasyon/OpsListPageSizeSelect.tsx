'use client';

import {
  OPS_LIST_PAGE_SIZE_OPTIONS,
  parseOpsListPageSize,
  writeOpsListPageSize,
  type OpsListPageSize,
} from '@/utils/ops-list-page-size';

export function OpsListPageSizeSelect({
  value,
  fallback,
  storageKey,
  onChange,
}: {
  value: OpsListPageSize;
  fallback: OpsListPageSize;
  storageKey: string;
  onChange: (next: OpsListPageSize) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="whitespace-nowrap">Sayfa</span>
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
        value={value}
        aria-label="Sayfada gösterilecek dosya sayısı"
        onChange={(e) => {
          const next = parseOpsListPageSize(e.target.value, fallback);
          writeOpsListPageSize(storageKey, next);
          onChange(next);
        }}
      >
        {OPS_LIST_PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
