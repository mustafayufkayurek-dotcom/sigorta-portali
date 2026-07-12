/** AK-001 — Müşteri / tedarikçi kart notları (numaralı + görünürlük) */

export type CardNoteVisibility = 'admin_only' | 'operations' | 'file_officer';

export type CardNote = {
  text: string;
  visibility: CardNoteVisibility;
};

export type CardNoteFormEntry = {
  text: string;
  visibility: CardNoteVisibility | '';
};

export const CARD_NOTE_VISIBILITY_OPTIONS: Array<{ value: CardNoteVisibility; label: string }> = [
  { value: 'admin_only', label: 'Yalnız Yönetici' },
  { value: 'operations', label: 'Tüm Operasyon' },
  { value: 'file_officer', label: 'Dosya Sorumlusu' },
];

export const CARD_NOTES_RELATION_HINT =
  'Numaralı notlar müşteri veya tedarikçi kartında kalıcı olarak görünür. Her not için kimlerin göreceğini seçin.';

const CARD_NOTES_JSON_MARKER = '__cardNotesV1__';

type StoredCardNotes = {
  v: 1;
  items: CardNote[];
};

function normalizeRoleCode(roleCode?: string | null): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

export function cardNoteVisibilityLabel(value?: string | null): string {
  return CARD_NOTE_VISIBILITY_OPTIONS.find((item) => item.value === value)?.label ?? '—';
}

export function emptyCardNoteEntries(minCount = 2): CardNoteFormEntry[] {
  return Array.from({ length: minCount }, () => ({ text: '', visibility: '' }));
}

export function parseCardNotes(raw: string | null | undefined): CardNote[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<StoredCardNotes> & Record<string, unknown>;
      if (parsed[CARD_NOTES_JSON_MARKER] === true && parsed.v === 1 && Array.isArray(parsed.items)) {
        return parsed.items
          .map((item) => ({
            text: String(item?.text ?? '').trim(),
            visibility: item?.visibility as CardNoteVisibility,
          }))
          .filter((item) => item.text && CARD_NOTE_VISIBILITY_OPTIONS.some((opt) => opt.value === item.visibility));
      }
    } catch {
      /* düz metin olarak devam */
    }
  }

  return [{ text: trimmed, visibility: 'operations' }];
}

export function cardNotesToFormEntries(raw: string | null | undefined, minCount = 2): CardNoteFormEntry[] {
  const parsed = parseCardNotes(raw);
  if (!parsed.length) return emptyCardNoteEntries(minCount);

  const entries: CardNoteFormEntry[] = parsed.map((item) => ({
    text: item.text,
    visibility: item.visibility,
  }));

  while (entries.length < minCount) {
    entries.push({ text: '', visibility: '' });
  }

  return entries;
}

export function serializeCardNotes(entries: CardNoteFormEntry[]): string | null {
  const items = entries
    .map((entry) => ({
      text: entry.text.trim(),
      visibility: entry.visibility,
    }))
    .filter(
      (entry): entry is CardNote =>
        Boolean(entry.text) && CARD_NOTE_VISIBILITY_OPTIONS.some((opt) => opt.value === entry.visibility),
    );

  if (!items.length) return null;

  const payload: StoredCardNotes = {
    v: 1,
    items,
  };

  return JSON.stringify({ [CARD_NOTES_JSON_MARKER]: true, ...payload });
}

export function validateCardNoteEntries(entries: CardNoteFormEntry[]): string | null {
  for (let i = 0; i < entries.length; i += 1) {
    const text = entries[i].text.trim();
    const visibility = entries[i].visibility;
    if (!text && !visibility) continue;
    if (text && !visibility) {
      return `${i + 1}. Not için «Kimler görsün» seçimi zorunludur.`;
    }
    if (!text && visibility) {
      return `${i + 1}. Not metni boş bırakılamaz.`;
    }
  }
  return null;
}

export function canViewCardNote(visibility: CardNoteVisibility, roleCode?: string | null): boolean {
  const role = normalizeRoleCode(roleCode);
  const isAdmin = role === 'admin' || role === 'manager' || role === 'ops_manager';
  const isOffice = role === 'office_staff';
  const isField = role === 'field_staff';

  switch (visibility) {
    case 'admin_only':
      return isAdmin;
    case 'operations':
      return isAdmin || isOffice || isField;
    case 'file_officer':
      return isAdmin || isOffice;
    default:
      return false;
  }
}

export function filterCardNotesForRole(notes: CardNote[], roleCode?: string | null): CardNote[] {
  return notes.filter((note) => canViewCardNote(note.visibility, roleCode));
}
