'use client';

import type { ActionRequiredItem } from '../_lib/survey-results-types';

const TONE: Record<ActionRequiredItem['tone'], { bar: string; badge: string; label: string }> = {
  critical: {
    bar: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700',
    label: 'Kritik',
  },
  warning: {
    bar: 'border-l-orange-500',
    badge: 'bg-orange-50 text-orange-700',
    label: 'Uyarı',
  },
  positive: {
    bar: 'border-l-status-success',
    badge: 'bg-emerald-50 text-emerald-700',
    label: 'Olumlu',
  },
};

export function ActionRequiredCard({ items }: { items: ActionRequiredItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Aksiyon Gerektiren Sonuçlar</h2>
        <p className="text-[11px] text-slate-400">
          Yalnız dikkat edilmesi gereken konular — rapor değil, aksiyon özeti.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-slate-400">
          Şu an aksiyon gerektiren sonuç yok.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const tone = TONE[item.tone];
            return (
              <li key={item.id} className={`border-l-4 px-4 py-3 ${tone.bar}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                    {tone.label}
                  </span>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-medium text-slate-500">Öneri: </span>
                  {item.recommendation}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
