'use client';

import { Star } from 'lucide-react';
import type { RecentResponseItem } from '../_lib/survey-results-types';

const VISIBLE_ITEMS = 5;

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3 w-3 ${
            n <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

export function RecentResponses({
  items,
  onSelect,
  onSeeAll,
}: {
  items: RecentResponseItem[];
  onSelect: (item: RecentResponseItem) => void;
  onSeeAll: () => void;
}) {
  const visible = items.slice(0, VISIBLE_ITEMS);

  return (
    <div className="flex max-h-[360px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Son Yanıtlar</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Tümünü Gör
        </button>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 text-center">
          <span className="text-base" aria-hidden>
            💬
          </span>
          <p className="mt-1 text-xs font-medium text-slate-700">Henüz yanıt bulunmuyor.</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
            İlk cevap geldiğinde burada gösterilecektir.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {item.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-800">{item.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.surveyName}</span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <Stars value={item.avgStars} />
                    <span className="whitespace-nowrap text-[10px] text-slate-400">
                      {item.submittedAtLabel}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
