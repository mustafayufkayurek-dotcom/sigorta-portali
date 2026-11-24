/** Ayarlar boş veya yetki kesilse bile formda tür seçimi açılır. */
export const DEFAULT_VENDOR_TYPES = ['Taşeron', 'Malzeme', 'Lojistik', 'Ekipman', 'Diğer'] as const;

/** Ofis / sabit hizmet — boş ayarda bu liste açılır. */
export const DEFAULT_OFIS_VENDOR_TYPES = [
  'Doğalgaz',
  'İnternet',
  'Elektrik',
  'Su',
  'Telekom',
  'Kira',
  'Diğer',
] as const;

function uniqueTypeList(raw: unknown, fallback: readonly string[]): string[] {
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const type of list) {
    const key = type.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(type);
  }
  return unique.length > 0 ? unique : [...fallback];
}

export function resolveVendorTypeList(raw: unknown): string[] {
  return uniqueTypeList(raw, DEFAULT_VENDOR_TYPES);
}

export function resolveOfisVendorTypeList(raw: unknown): string[] {
  return uniqueTypeList(raw, DEFAULT_OFIS_VENDOR_TYPES);
}
