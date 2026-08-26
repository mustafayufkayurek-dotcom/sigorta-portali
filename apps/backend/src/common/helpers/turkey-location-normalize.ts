/** İl / ilçe etiketlerini resmi ada yaklaştırır (Afyon, Kutahya, Kartepe). */

export function foldLocationKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/** Kısa konuşma adı → resmi il adı. */
const PROVINCE_ALIAS_TO_CANONICAL: Record<string, string> = {
  afyon: 'Afyonkarahisar',
  afyonkarahisar: 'Afyonkarahisar',
  icel: 'Mersin',
  mersin: 'Mersin',
  maras: 'Kahramanmaraş',
  kmaras: 'Kahramanmaraş',
  kahramanmaras: 'Kahramanmaraş',
  urfa: 'Şanlıurfa',
  sanliurfa: 'Şanlıurfa',
  antep: 'Gaziantep',
  gaziantep: 'Gaziantep',
};

const PROVINCE_ALIAS_SPELLINGS: Record<string, string[]> = {
  afyonkarahisar: ['Afyon'],
  mersin: ['İçel'],
  kahramanmaras: ['Maraş', 'K.Maraş', 'K. Maraş'],
  sanliurfa: ['Urfa'],
  gaziantep: ['Antep'],
};

export function canonicalProvinceFromAlias(raw?: string | null): string | null {
  const folded = foldLocationKey(raw ?? '');
  if (!folded) return null;
  return PROVINCE_ALIAS_TO_CANONICAL[folded] ?? null;
}

export function provinceSearchNames(officialName: string): string[] {
  const names = [officialName];
  const extra = PROVINCE_ALIAS_SPELLINGS[foldLocationKey(officialName)] ?? [];
  for (const alias of extra) {
    if (!names.some((n) => foldLocationKey(n) === foldLocationKey(alias))) {
      names.push(alias);
    }
  }
  return names;
}

export function locationNameVariants(raw?: string | null): string[] {
  const text = raw?.trim();
  if (!text) return [];
  const names = [text];
  const canonical = canonicalProvinceFromAlias(text);
  if (canonical && foldLocationKey(canonical) !== foldLocationKey(text)) {
    names.push(canonical);
  }
  return names;
}

export function matchNamedLocation<T extends { name: string }>(
  raw: string | null | undefined,
  rows: T[],
): T | null {
  const folded = foldLocationKey(raw ?? '');
  if (!folded) return null;
  const byFold = rows.find((row) => foldLocationKey(row.name) === folded);
  if (byFold) return byFold;
  const canonical = PROVINCE_ALIAS_TO_CANONICAL[folded];
  if (!canonical) return null;
  const canonicalFold = foldLocationKey(canonical);
  return rows.find((row) => foldLocationKey(row.name) === canonicalFold) ?? null;
}

/**
 * "Kocaeli Kartepe" / "Kocaeli / Kartepe" → resmi il + kalan ilçe.
 * İl adı eşleşmezse ham metni city olarak bırakır.
 */
export function splitCombinedLocation(
  raw: string,
  officialProvinceNames: string[],
): { city: string; district: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { city: trimmed, district: null };
  const provinces = officialProvinceNames.map((name) => ({ name }));
  const whole = matchNamedLocation(trimmed, provinces);
  if (whole) return { city: whole.name, district: null };

  const tokens = trimmed.split(/[\s/,|-]+/).map((part) => part.trim()).filter(Boolean);
  if (tokens.length < 2) return { city: trimmed, district: null };

  for (let i = 1; i < tokens.length; i += 1) {
    const head = tokens.slice(0, i).join(' ');
    const tail = tokens.slice(i).join(' ');
    const province = matchNamedLocation(head, provinces);
    if (province && tail) return { city: province.name, district: tail };
  }
  return { city: trimmed, district: null };
}
