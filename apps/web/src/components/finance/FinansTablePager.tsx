'use client';

import {
  FINANS_TABLE_PAGE_SIZE_OPTIONS,
  finansPageNumbers,
  parseFinansTablePageSize,
  writeFinansTablePageSize,
  type FinansTablePageSize,
} from '@/utils/finans-table-page';

export function FinansTablePager({
  page,
  pageSize,
  total,
  storageKey,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: FinansTablePageSize;
  total: number;
  storageKey: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: FinansTablePageSize) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const numbers = finansPageNumbers(safePage, totalPages);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700"
      data-testid="finans-tablo-sayfalama"
    >
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <span className="whitespace-nowrap">Sayfa</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          value={pageSize}
          aria-label="Sayfada gösterilecek kayıt sayısı"
          onChange={(e) => {
            const next = parseFinansTablePageSize(e.target.value, 10);
            writeFinansTablePageSize(storageKey, next);
            onPageSizeChange(next);
            onPageChange(1);
          }}
        >
          {FINANS_TABLE_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-slate-400">
          {total === 0 ? '0 kayıt' : `${from}–${to} / ${total}`}
        </span>
      </label>
      <nav className="flex items-center justify-end gap-1" aria-label="Sayfa numaraları">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          ‹
        </button>
        {numbers.map((n, idx) =>
          n === '…' ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={`min-w-7 rounded-lg px-2 py-1 text-xs ${
                n === safePage
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          ›
        </button>
      </nav>
    </div>
  );
}
