'use client';

import type { QuickDatePreset } from '../_lib/survey-results-adapters';

const PRESETS: { id: QuickDatePreset; label: string }[] = [
  { id: 'bugun', label: 'Bugün' },
  { id: 'bu_hafta', label: 'Bu Hafta' },
  { id: 'bu_ay', label: 'Bu Ay' },
  { id: 'ozel', label: 'Özel Tarih' },
];

export function QuickDatePresets({
  active,
  onSelect,
}: {
  active: QuickDatePreset;
  onSelect: (preset: QuickDatePreset) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESETS.map((p) => {
        const selected = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
