/** Masraf Açıklama — son yazılanlar (yerel hatırlama). Kısa ad / başka ekrana yayılmaz. */

import { normalizeMasrafAciklamaForSave } from '@sigorta/shared';

export const MASRAF_ACIKLAMA_HATIRLA_KEY = 'finans-masraf-aciklama-son';
export const MASRAF_ACIKLAMA_HATIRLA_MAX = 12;

function normalizeHatirlaItem(text: string): string {
  return normalizeMasrafAciklamaForSave(text);
}

function dedupeNormalized(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const fixed = normalizeHatirlaItem(item);
    if (!fixed) continue;
    const key = fixed.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fixed);
    if (out.length >= MASRAF_ACIKLAMA_HATIRLA_MAX) break;
  }
  return out;
}

export function readMasrafAciklamaHatirla(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MASRAF_ACIKLAMA_HATIRLA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const fixed = dedupeNormalized(parsed.map((x) => String(x ?? '')));
    // Eski hatalı kayıtları bir kez yazıma çek
    try {
      window.localStorage.setItem(MASRAF_ACIKLAMA_HATIRLA_KEY, JSON.stringify(fixed));
    } catch {
      /* kota */
    }
    return fixed;
  } catch {
    return [];
  }
}

export function rememberMasrafAciklama(text: string): string[] {
  const next = normalizeHatirlaItem(text);
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
