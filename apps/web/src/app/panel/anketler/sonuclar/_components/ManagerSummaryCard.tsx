'use client';

import type { ManagerSummaryColumn } from '../_lib/survey-results-types';

const TONE_DOT: Record<ManagerSummaryColumn['tone'], string> = {
  positive: 'bg-status-success',
  warning: 'bg-orange-500',
  alert: 'bg-rose-500',
  neutral: 'bg-amber-400',
};

const TITLE_ICON: Record<ManagerSummaryColumn['id'], string> = {
  week: '🟢',
  highlight: '⭐',
  action: '⚠',
};

export function ManagerSummaryCard({
  columns,
  onOpenDetail,
}: {
  columns: ManagerSummaryColumn[];
  onOpenDetail: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Yönetici Özeti</h2>
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-xs font-medium text-brand-600 hover:text-blue-700"
        >
          Detayı Gör
        </button>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {columns.map((col) => (
          <div key={col.id} className="flex min-w-0 items-start gap-2 px-0 py-2 md:px-3 md:py-0 first:md:pl-0 last:md:pr-0">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[col.tone]}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-700">
                <span className="mr-1" aria-hidden>
                  {TITLE_ICON[col.id]}
                </span>
                {col.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{col.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
