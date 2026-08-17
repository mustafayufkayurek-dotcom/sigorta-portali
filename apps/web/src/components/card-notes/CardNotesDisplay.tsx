'use client';

import { usePanelAccess } from '@/hooks/usePanelAccess';
import {
  cardNoteVisibilityLabel,
  filterCardNotesForRole,
  parseCardNotes,
} from '@/utils/card-notes';

type CardNotesDisplayProps = {
  notesRaw: string | null | undefined;
  emptyMessage?: string;
};

export function CardNotesDisplay({
  notesRaw,
  emptyMessage = 'Kart Notu Girilmemiş.',
}: CardNotesDisplayProps) {
  const { roleCode } = usePanelAccess();
  const allNotes = parseCardNotes(notesRaw);
  const visibleNotes = filterCardNotesForRole(allNotes, roleCode);

  if (!visibleNotes.length) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {visibleNotes.map((note, index) => (
        <div
          key={`visible-card-note-${index}`}
          className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-slate-500">{index + 1}. Not</p>
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600">
              {cardNoteVisibilityLabel(note.visibility)}
            </span>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
        </div>
      ))}
    </div>
  );
}
