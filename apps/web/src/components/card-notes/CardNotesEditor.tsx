'use client';

import {
  CARD_NOTE_VISIBILITY_OPTIONS,
  type CardNoteFormEntry,
} from '@/utils/card-notes';
import { toTitleCaseTR } from '@/utils/text-helpers';

type Accent = 'emerald' | 'indigo';

const accentRing: Record<Accent, string> = {
  emerald: 'focus:ring-status-success/30 focus:border-emerald-400',
  indigo: 'focus:ring-indigo-500/30 focus:border-indigo-400',
};

type CardNotesEditorProps = {
  entries: CardNoteFormEntry[];
  onChange: (entries: CardNoteFormEntry[]) => void;
  accent?: Accent;
  error?: string | null;
};

export function CardNotesEditor({
  entries,
  onChange,
  accent = 'emerald',
  error,
}: CardNotesEditorProps) {
  const ring = accentRing[accent];

  const updateEntry = (index: number, patch: Partial<CardNoteFormEntry>) => {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    onChange([...entries, { text: '', visibility: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 2) return;
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <div
          key={`card-note-${index}`}
          className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">{index + 1}. Not</p>
            {entries.length > 2 && (
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="text-xs text-slate-400 hover:text-status-danger transition-colors"
              >
                Kaldır
              </button>
            )}
          </div>
          <textarea
            rows={3}
            className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${ring}`}
            placeholder="Operasyonel Tespit Veya İlişki Notu..."
            value={entry.text}
            onChange={(e) => updateEntry(index, { text: e.target.value })}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v !== entry.text) updateEntry(index, { text: v });
            }}
          />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Kimler Görsün</label>
            <select
              className={`w-full border border-slate-200 rounded-lg px-3 py-2 h-[38px] text-sm bg-white focus:outline-none focus:ring-2 ${ring}`}
              value={entry.visibility}
              onChange={(e) =>
                updateEntry(index, { visibility: e.target.value as CardNoteFormEntry['visibility'] })
              }
            >
              <option value="">Seçin...</option>
              {CARD_NOTE_VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
      >
        + Not Ekle
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
