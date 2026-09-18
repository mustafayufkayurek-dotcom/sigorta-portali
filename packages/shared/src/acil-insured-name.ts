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

function titleName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    })
    .join(' ');
}

function pickInsured(candidate: string | null | undefined, firmNames: Array<string | null | undefined>): string | null {
  const name = titleName(String(candidate ?? '')).slice(0, 80);
  if (isEmptyInsured(name) || sameAsFirm(name, firmNames)) return null;
  return name;
}

function fromNotes(notes: string | null | undefined, firmNames: Array<string | null | undefined>): string | null {
  const note = String(notes ?? '').trim();
  const labeled = note.match(/sigortal[ıi]\s*[:：]\s*(.+)/i);
  const fromLabel = pickInsured(labeled?.[1]?.split(/[\n|]/)[0], firmNames);
  if (fromLabel) return fromLabel;

  const adina = note.match(/(?:^|\n)([^\n]{2,80}?)\s+adına yapılan/i);
  const fromAdina = pickInsured(adina?.[1], firmNames);
  if (fromAdina) return fromAdina;

  const ihbar = note.match(/gelen kutusu ihbarı:\s*([^\n]+)/i);
  const slashName = ihbar?.[1]
    ?.split('/')
    .map((p) => p.trim())
    .find((p) => p && !/^\d+$/.test(p) && !/^RCS-/i.test(p) && /\s/.test(p));
  return pickInsured(slashName, firmNames);
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
