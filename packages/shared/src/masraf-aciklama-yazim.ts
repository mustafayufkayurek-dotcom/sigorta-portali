/**
 * Masraf açıklama yazım düzeltmesi.
 * «Akatyakıt» → «Akaryakıt» (büyük/küçük duyarsız).
 */

const YAZIM_DUZELT: ReadonlyArray<{ wrong: string; right: string }> = [
  { wrong: 'akatyakıt', right: 'akaryakıt' },
  { wrong: 'akatyakit', right: 'akaryakıt' },
];

function titleWordTR(word: string): string {
  if (!word) return word;
  const lower = word.toLocaleLowerCase('tr-TR');
  const first = lower.charAt(0).toLocaleUpperCase('tr-TR');
  return first + lower.slice(1);
}

/** Kelime bazlı bilinen yazım hatalarını düzeltir. */
export function correctMasrafAciklamaYazim(text: string): string {
  const raw = String(text ?? '');
  if (!raw.trim()) return raw.trim();
  return raw.replace(/(\p{L}+)/gu, (word) => {
    const key = word.toLocaleLowerCase('tr-TR');
    for (const rule of YAZIM_DUZELT) {
      if (key === rule.wrong) {
        const right = rule.right;
        const firstUpper = word[0] === word[0]?.toLocaleUpperCase('tr-TR');
        return firstUpper ? titleWordTR(right) : right;
      }
    }
    return word;
  });
}

/**
 * Kayıt / hatırlama öncesi: yazım düzelt + Title Case benzeri ilk harf.
 * Tam cümle Title Case çağıran tarafın işidir (web toTitleCaseTR).
 */
export function normalizeMasrafAciklamaForSave(text: string): string {
  return correctMasrafAciklamaYazim(String(text ?? '').trim());
}
