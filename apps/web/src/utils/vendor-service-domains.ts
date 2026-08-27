export type VendorServiceDomain = 'cilingir' | 'konut' | 'arac';

function foldTr(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

const VEHICLE_RE = /arac|oto|cekici|lastik|aku|yol.?yardim|otomobil|minibus/;
const HOUSING_RE =
  /konut|isyeri|mesken|daire|apartman|tesisat|cati|cam|elektrik|dogalgaz|yangin|hirsiz|boru|asansor|su bask|su kac/;
const LOCKSMITH_RE = /cilingir|cingir|kilit|kapi/;

/**
 * Tedarikçi hizmet kollarından faaliyet ikonu.
 * Çilingir tek anahtar ikonu; diğerlerinde konut / araç.
 */
export function resolveVendorServiceDomains(
  branches?: string[] | null,
  name?: string | null,
  hint?: string | null,
): VendorServiceDomain[] {
  const blob = foldTr([name ?? '', hint ?? '', ...(branches ?? [])].join(' '));
  if (LOCKSMITH_RE.test(blob)) return ['cilingir'];
  const vehicle = VEHICLE_RE.test(blob);
  const housing = HOUSING_RE.test(blob);
  if (housing && vehicle) return ['konut', 'arac'];
  if (vehicle) return ['arac'];
  return ['konut'];
}
