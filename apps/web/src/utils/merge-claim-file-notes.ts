export type ClaimFileNoteRow = {
  id: string;
  content: string;
  noteType: string;
  createdAt: string;
  author?: { firstName?: string; lastName?: string };
};

/**
 * `notes` + `timeline_notes` birleştirir; aynı içerik/zaman çiftlerini tekilleştirir.
 * Eski portal notları yalnızca timeline'da kaldıysa Dosya Notları panelinde de görünsün.
 */
export function mergeClaimFileNotes(
  fromNotes: ClaimFileNoteRow[],
  fromTimeline: ClaimFileNoteRow[],
): ClaimFileNoteRow[] {
  const merged: ClaimFileNoteRow[] = [...fromNotes];
  for (const t of fromTimeline) {
    const content = (t.content ?? '').trim();
    const tAt = new Date(t.createdAt).getTime();
    const dup = merged.some((n) => {
      if ((n.content ?? '').trim() !== content) return false;
      const nAt = new Date(n.createdAt).getTime();
      return Number.isFinite(nAt) && Number.isFinite(tAt) && Math.abs(nAt - tAt) < 8000;
    });
    if (!dup) {
      merged.push({
        id: t.id,
        content: t.content,
        noteType: t.noteType || 'general',
        createdAt: t.createdAt,
        author: t.author,
      });
    }
  }
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}
