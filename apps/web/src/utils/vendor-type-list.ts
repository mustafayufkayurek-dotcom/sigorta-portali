/** Ayarlar boş veya yetki kesilse bile formda tür seçimi açılır. */
export const DEFAULT_VENDOR_TYPES = ['Taşeron', 'Malzeme', 'Lojistik', 'Ekipman', 'Diğer'] as const;

export function resolveVendorTypeList(raw: unknown): string[] {
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
  return unique.length > 0 ? unique : [...DEFAULT_VENDOR_TYPES];
}
