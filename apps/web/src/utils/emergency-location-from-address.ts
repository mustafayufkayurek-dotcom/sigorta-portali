import { stripInboundAddressPollution } from '@sigorta/shared';
import { districts as STATIC_DISTRICTS, provinces as STATIC_PROVINCES } from '@/data/turkey-locations';

function foldPlaceChars(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function includesPlaceName(haystack: string, place: string): boolean {
  const p = foldPlaceChars(place).trim();
  if (p.length < 3) return false;
  const text = foldPlaceChars(haystack);
  let from = 0;
  while (from <= text.length) {
    const idx = text.indexOf(p, from);
    if (idx < 0) return false;
    const before = idx === 0 ? '' : text[idx - 1];
    const afterIdx = idx + p.length;
    const after = afterIdx >= text.length ? '' : text[afterIdx];
    const isBoundary = (ch: string) => !ch || /[^\p{L}\p{N}]/u.test(ch);
    if (isBoundary(before) && isBoundary(after)) return true;
    from = idx + 1;
  }
  return false;
}

/** Kayıtlı il boşsa adres metninden il / ilçe (ASCII Usak dahil). */
export function deriveEmergencyLocation(input: {
  city?: string | null;
  district?: string | null;
  address?: string | null;
}): { city?: string; district?: string } {
  const city = input.city?.trim() || '';
  const district = input.district?.trim() || '';
  if (city) return { city, district: district || undefined };

  const address = stripInboundAddressPollution(input.address);
  if (!address) return {};

  const sorted = [...STATIC_PROVINCES].sort((a, b) => b.name.length - a.name.length);
  let matched: (typeof STATIC_PROVINCES)[number] | undefined;
  for (const p of sorted) {
    const labels = p.name === 'Afyonkarahisar' ? [p.name, 'Afyon'] : [p.name];
    if (labels.some((label) => includesPlaceName(address, label))) {
      matched = p;
      break;
    }
  }
  if (!matched) return {};

  const districts = STATIC_DISTRICTS[matched.code] ?? [];
  const districtHit = [...districts]
    .sort((a, b) => b.length - a.length)
    .find((name) => includesPlaceName(address, name));

  return { city: matched.name, district: districtHit };
}
