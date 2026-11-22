/** Masraf Açıklama — son yazılanlar (yerel hatırlama). Kısa ad / başka ekrana yayılmaz. */

export const MASRAF_ACIKLAMA_HATIRLA_KEY = 'finans-masraf-aciklama-son';
export const MASRAF_ACIKLAMA_HATIRLA_MAX = 12;

export function readMasrafAciklamaHatirla(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MASRAF_ACIKLAMA_HATIRLA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, MASRAF_ACIKLAMA_HATIRLA_MAX);
  } catch {
    return [];
  }
}

export function rememberMasrafAciklama(text: string): string[] {
  const next = String(text ?? '').trim();
  if (!next || typeof window === 'undefined') return readMasrafAciklamaHatirla();
  const prev = readMasrafAciklamaHatirla().filter(
    (x) => x.toLocaleLowerCase('tr-TR') !== next.toLocaleLowerCase('tr-TR'),
  );
  const list = [next, ...prev].slice(0, MASRAF_ACIKLAMA_HATIRLA_MAX);
  try {
    window.localStorage.setItem(MASRAF_ACIKLAMA_HATIRLA_KEY, JSON.stringify(list));
  } catch {
    /* kota / gizli mod */
  }
  return list;
}
