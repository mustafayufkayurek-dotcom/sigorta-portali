/** Acil dosyada sigortalı kişi adı. Asistan/sigorta firma unvanı basılmaz. */

const EMPTY = new Set(['', '—', '-', 'belirtilmemiş', 'belirtilmedi']);

export const INBOUND_INSURED_NAME_FIELD_LABELS = [
  'Sigortalı Adı Soyadı',
  'Sigortalı Ad Soyad',
  'Sigortalı Adı',
  'Sigortalı',
  'Sigorta Ettiren Ad-Soyad',
  'Sigorta Ettiren',
] as const;

export function foldAcilInsuredLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/** Onayda yazılan Ad Soyad dosya kaydıyla aynı mı. Boş kayıtta uyarı yok. */
export function acilInsuredNamesMatch(
  typed: string,
  expected: string | null | undefined,
): boolean {
  const a = foldAcilInsuredLabel(typed);
  const b = foldAcilInsuredLabel(expected);
  if (!b || EMPTY.has(b)) return true;
  return a === b;
}

function isEmptyInsured(value: string | null | undefined): boolean {
  const folded = foldAcilInsuredLabel(value);
  return !folded || EMPTY.has(folded);
}

function sameAsFirm(person: string, firmNames: Array<string | null | undefined>): boolean {
  const folded = foldAcilInsuredLabel(person);
  return firmNames.some((firm) => {
    const f = foldAcilInsuredLabel(firm);
    return Boolean(f) && f === folded;
  });
}

function fromNotes(notes: string | null | undefined, firmNames: Array<string | null | undefined>): string | null {
  const note = String(notes ?? '').trim();
  const m = note.match(/sigortal[ıi]\s*[:：]\s*(.+)/i);
  if (!m?.[1]) return null;
  const fromNote = m[1].split(/[\n|]/)[0].trim().slice(0, 80);
  if (isEmptyInsured(fromNote) || sameAsFirm(fromNote, firmNames)) return null;
  return fromNote;
}

export function resolveAcilInsuredName(input: {
  personField?: string | null;
  notes?: string | null;
  firmNames?: Array<string | null | undefined>;
}): string | null {
  const firms = input.firmNames ?? [];
  const fromField = String(input.personField ?? '').trim();
  if (!isEmptyInsured(fromField) && !sameAsFirm(fromField, firms)) return fromField;
  return fromNotes(input.notes, firms);
}
