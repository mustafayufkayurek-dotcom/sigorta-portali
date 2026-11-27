/** Masraf Açıklama / Belge Sahibi — son yazılanlar (yerel hatırlama). Kısa ad / başka ekrana yayılmaz. */

import { normalizeMasrafAciklamaForSave } from '@sigorta/shared';

export const MASRAF_ACIKLAMA_HATIRLA_KEY = 'finans-masraf-aciklama-son';
export const MASRAF_BELGE_SAHIBI_HATIRLA_KEY = 'finans-masraf-belge-sahibi-son';
export const MASRAF_ACIKLAMA_HATIRLA_MAX = 12;
export const MASRAF_HATIRLA_CHIP_MAX = 8;

/** Belge Sahibi hatırlama — Title Case (Mustafa Yufkayürek). text-helpers’a bağlanmaz (kilit Node yolu). */
function titleCaseTrBelgeSahibi(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    })
    .join(' ');
}

function dedupeNormalized(list: string[], normalize: (t: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const fixed = normalize(item);
    if (!fixed) continue;
    const key = fixed.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fixed);
    if (out.length >= MASRAF_ACIKLAMA_HATIRLA_MAX) break;
  }
  return out;
}

function readHatirlaList(storageKey: string, normalize: (t: string) => string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const fixed = dedupeNormalized(
      parsed.map((x) => String(x ?? '')),
      normalize,
    );
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(fixed));
    } catch {
      /* kota */
    }
    return fixed;
  } catch {
    return [];
  }
}

function rememberHatirlaList(
  storageKey: string,
  text: string,
  normalize: (t: string) => string,
  read: () => string[],
): string[] {
  const next = normalize(text);
  if (!next || typeof window === 'undefined') return read();
  const prev = read().filter(
    (x) => x.toLocaleLowerCase('tr-TR') !== next.toLocaleLowerCase('tr-TR'),
  );
  const list = [next, ...prev].slice(0, MASRAF_ACIKLAMA_HATIRLA_MAX);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    /* kota / gizli mod */
  }
  return list;
}

function normalizeAciklama(text: string): string {
  return normalizeMasrafAciklamaForSave(text);
}

function normalizeBelgeSahibi(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t ? titleCaseTrBelgeSahibi(t) : '';
}

export function readMasrafAciklamaHatirla(): string[] {
  return readHatirlaList(MASRAF_ACIKLAMA_HATIRLA_KEY, normalizeAciklama);
}

export function rememberMasrafAciklama(text: string): string[] {
  return rememberHatirlaList(
    MASRAF_ACIKLAMA_HATIRLA_KEY,
    text,
    normalizeAciklama,
    readMasrafAciklamaHatirla,
  );
}

export function readMasrafBelgeSahibiHatirla(): string[] {
  return readHatirlaList(MASRAF_BELGE_SAHIBI_HATIRLA_KEY, normalizeBelgeSahibi);
}

export function rememberMasrafBelgeSahibi(text: string): string[] {
  return rememberHatirlaList(
    MASRAF_BELGE_SAHIBI_HATIRLA_KEY,
    text,
    normalizeBelgeSahibi,
    readMasrafBelgeSahibiHatirla,
  );
}
