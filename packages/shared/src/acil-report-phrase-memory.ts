const MAX_PER_FIELD = 80;

export type AcilReportPhraseField = 'mahal' | 'jobDescription' | 'itemDescription';

export type AcilReportPhraseStore = Record<AcilReportPhraseField, string[]>;

function foldTr(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

export function emptyAcilReportPhraseStore(): AcilReportPhraseStore {
  return { mahal: [], jobDescription: [], itemDescription: [] };
}

export function rememberAcilReportPhrase(
  store: AcilReportPhraseStore,
  field: AcilReportPhraseField,
  raw: string,
): AcilReportPhraseStore {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < 2) return store;
  const folded = foldTr(value);
  const rest = (store[field] ?? []).filter((item) => foldTr(item) !== folded);
  return { ...store, [field]: [value, ...rest].slice(0, MAX_PER_FIELD) };
}

export function matchAcilReportPhrases(query: string, phrases: string[], limit = 8): string[] {
  const q = foldTr(query);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of phrases) {
    const text = phrase.replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    const key = foldTr(text);
    if (seen.has(key)) continue;
    if (q && !key.startsWith(q)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}
