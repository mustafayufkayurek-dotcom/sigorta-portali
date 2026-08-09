/** AK-001 — Müşteri / tedarikçi kart notları (numaralı; iç ekip görünür) */

export type CardNoteVisibility = 'admin_only' | 'operations' | 'file_officer';

export type CardNote = {
  text: string;
  visibility: CardNoteVisibility;
};

export type CardNoteFormEntry = {
  text: string;
  visibility: CardNoteVisibility | '';
};

/** Kayıt formatı geriye uyumlu; yeni notlar her zaman operations yazar. */
export const CARD_NOTE_VISIBILITY_OPTIONS: Array<{ value: CardNoteVisibility; label: string }> = [
  { value: 'admin_only', label: 'Yalnız Yönetici' },
  { value: 'operations', label: 'İç Ekip' },
  { value: 'file_officer', label: 'Dosya Sorumlusu' },
];

/** Varsayılan: müşteri / portal hariç tüm iç ekip. */
export const DEFAULT_CARD_NOTE_VISIBILITY: CardNoteVisibility = 'operations';

export const CARD_NOTES_RELATION_HINT =
  'Numaralı notlar müşteri veya tedarikçi kartında kalıcı olarak görünür. Notlar müşteri portalları hariç iç ekibe açıktır.';

const CARD_NOTES_JSON_MARKER = '__cardNotesV1__';

type StoredCardNotes = {
  v: 1;
  items: CardNote[];
};

function normalizeRoleCode(roleCode?: string | null): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

/** Müşteri / dış portal rolleri — kart notu görmez. */
function isCustomerOrPortalRole(roleCode?: string | null): boolean {
  const role = normalizeRoleCode(roleCode);
  if (!role) return false;
  return (
    role.includes('insurance') ||
    role.includes('customer') ||
    role === 'insured' ||
    role === 'portal_user' ||
    role === 'expert' ||
    role === 'adjuster' ||
    role === 'insurance_company_user'
  );
}

export function cardNoteVisibilityLabel(_value?: string | null): string {
  return 'İç Ekip';
}

export function emptyCardNoteEntries(minCount = 2): CardNoteFormEntry[] {
  return Array.from({ length: minCount }, () => ({
    text: '',
    visibility: DEFAULT_CARD_NOTE_VISIBILITY,
  }));
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
            // Eski kısıtlı görünürlükler okumada iç ekibe açılır
            visibility: DEFAULT_CARD_NOTE_VISIBILITY,
          }))
          .filter((item) => item.text);
      }
    } catch {
      /* düz metin olarak devam */
    }
  }

  return [{ text: trimmed, visibility: DEFAULT_CARD_NOTE_VISIBILITY }];
}

export function cardNotesToFormEntries(raw: string | null | undefined, minCount = 2): CardNoteFormEntry[] {
  const parsed = parseCardNotes(raw);
  if (!parsed.length) return emptyCardNoteEntries(minCount);

  const entries: CardNoteFormEntry[] = parsed.map((item) => ({
    text: item.text,
    visibility: DEFAULT_CARD_NOTE_VISIBILITY,
  }));

  while (entries.length < minCount) {
    entries.push({ text: '', visibility: DEFAULT_CARD_NOTE_VISIBILITY });
  }

  return entries;
}

export function serializeCardNotes(entries: CardNoteFormEntry[]): string | null {
  const items = entries
    .map((entry) => ({
      text: entry.text.trim(),
      visibility: DEFAULT_CARD_NOTE_VISIBILITY,
    }))
    .filter((entry): entry is CardNote => Boolean(entry.text));

  if (!items.length) return null;

  const payload: StoredCardNotes = {
    v: 1,
    items,
  };

  return JSON.stringify({ [CARD_NOTES_JSON_MARKER]: true, ...payload });
}

export function validateCardNoteEntries(_entries: CardNoteFormEntry[]): string | null {
  // Görünürlük seçimi kaldırıldı; boş satırlar serbest, dolu satırlar geçerlidir.
  return null;
}

export function canViewCardNote(_visibility: CardNoteVisibility, roleCode?: string | null): boolean {
  return !isCustomerOrPortalRole(roleCode);
}

export function filterCardNotesForRole(notes: CardNote[], roleCode?: string | null): CardNote[] {
  return notes.filter((note) => canViewCardNote(note.visibility, roleCode));
}
