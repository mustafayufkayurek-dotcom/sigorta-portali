/**
 * Türkçe karakter destekli Title Case dönüştürücü (backend/Node.js versiyonu).
 * "mustafa yufkayürek" → "Mustafa Yufkayürek"
 * "tic. a.ş." → "Tic. A.Ş."
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

  const titleCaseToken = (token: string): string => {
    let result = '';
    let capitalizeNext = true;

    for (const c of token) {
      if (/[\p{L}]/u.test(c)) {
        result += capitalizeNext
          ? (upperMap[c] ?? c.toUpperCase())
          : (lowerMap[c] ?? c.toLowerCase());
        capitalizeNext = false;
      } else if (c === '.') {
        result += c;
        capitalizeNext = true;
      } else {
        result += c;
      }
    }

    return result;
  };

  return str
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      return part
        .split(/(-+)/)
        .map((segment) => {
          if (/^-+$/.test(segment) || !segment) return segment;
          return titleCaseToken(segment);
        })
        .join('');
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
