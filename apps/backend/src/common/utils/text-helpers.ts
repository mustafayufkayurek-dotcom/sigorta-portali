/**
 * Türkçe karakter destekli Title Case dönüştürücü (backend/Node.js versiyonu).
 * "mustafa yufkayürek" → "Mustafa Yufkayürek"
 * "MUSTAFA YUFKAYÜREK" → "Mustafa Yufkayürek"
 *
 * Idempotent: Boş/null değerleri olduğu gibi döndürür.
 */
export function toTitleCaseTR(str: string | null | undefined): string {
  if (!str) return str as string;
  const lowerMap: Record<string, string> = {
    I: 'ı',
    İ: 'i',
    Ğ: 'ğ',
    Ü: 'ü',
    Ş: 'ş',
    Ö: 'ö',
    Ç: 'ç',
  };
  const upperMap: Record<string, string> = {
    ı: 'I',
    i: 'İ',
    ğ: 'Ğ',
    ü: 'Ü',
    ş: 'Ş',
    ö: 'Ö',
    ç: 'Ç',
  };
  return str
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const first = part.charAt(0);
      const rest = part.slice(1);
      const upperFirst = upperMap[first] ?? first.toUpperCase();
      const lowerRest = rest
        .split('')
        .map((c) => lowerMap[c] ?? c.toLowerCase())
        .join('');
      return upperFirst + lowerRest;
    })
    .join('');
}

/** Nesne üzerindeki belirtilen string alanlarına toTitleCaseTR uygular (in-place) */
export function applyTitleCase<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): T {
  for (const field of fields) {
    const val = obj[field];
    if (typeof val === 'string') {
      (obj as any)[field] = toTitleCaseTR(val.trim()) || val;
    }
  }
  return obj;
}
