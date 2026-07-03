/**
 * Türkçe karakter destekli Title Case dönüştürücü.
 * "mustafa yufkayürek" → "Mustafa Yufkayürek"
 * "MUSTAFA YUFKAYÜREK" → "Mustafa Yufkayürek"
 * "tic. a.ş." → "Tic. A.Ş." (nokta sonrası harf büyük)
 *
 * Idempotent: Zaten düzgün biçimlendirilmiş metni yeniden işlese de aynı çıktıyı üretir.
 */
export function toTitleCaseTR(str: string): string {
  if (!str) return str;

  const lowerMap: Record<string, string> = {
    I: 'ı', İ: 'i', Ğ: 'ğ', Ü: 'ü', Ş: 'ş', Ö: 'ö', Ç: 'ç',
  };
  const upperMap: Record<string, string> = {
    ı: 'I', i: 'İ', ğ: 'Ğ', ü: 'Ü', ş: 'Ş', ö: 'Ö', ç: 'Ç',
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

/**
 * Türkçe karakterleri İngilizce karşılıklarıyla değiştirip
 * büyük harfe dönüştürerek kod alanına uygun string üretir.
 * "Hasar Onarım" → "HASAR_ONARIM"
 * Yalnızca [A-Z0-9_] karakterlerine izin verir.
 */
export function sanitizeCode(str: string): string {
  const trMap: Record<string, string> = {
    'ş': 'S', 'Ş': 'S', 'ç': 'C', 'Ç': 'C', 'ğ': 'G', 'Ğ': 'G',
    'ü': 'U', 'Ü': 'U', 'ö': 'O', 'Ö': 'O', 'ı': 'I', 'İ': 'I',
  };
  return str
    .split('')
    .map((c) => trMap[c] ?? c)
    .join('')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

/**
 * Ad alanından otomatik kod önerisi üretir.
 * "Hasar Onarım" → "HASAR_ONARIM"
 */
export function generateCodeFromName(name: string): string {
  return sanitizeCode(name.trim());
}

/**
 * Sıralı kod üretir: prefix + sıfır dolgu + numara
 * generateSequentialCode('IG', 3) → 'IG003'
 */
export function generateSequentialCode(prefix: string, count: number, padLength = 3): string {
  return prefix + String(count).padStart(padLength, '0');
}

/** Arama kutularında TR locale + I/İ/ı eşlemesi (istanbul → İstanbul) */
export function normalizeSearchTR(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i');
}

/** Türkçe alfabetik sıralama */
export function sortCompareTR(a: string, b: string): number {
  return a.localeCompare(b, 'tr', { sensitivity: 'base' });
}

export function sortByNameTR<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => sortCompareTR(a.name, b.name));
}

/** Fatura/mailden yapıştırılan tamamen büyük harf metinleri tespit eder */
export function looksAllCapsTR(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  return t === t.toLocaleUpperCase('tr-TR') && /[\p{L}]/u.test(t);
}

/** Serbest metin alanı — yapıştırma sonrası otomatik Title Case */
export function normalizeFreeTextInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return looksAllCapsTR(trimmed) ? toTitleCaseTR(trimmed) : value;
}

/** Form serbest metin — blur ve kayıt öncesi Title Case (boşsa boş döner) */
export function normalizeFormFreeText(value: string): string {
  const trimmed = value.trim();
  return trimmed ? toTitleCaseTR(trimmed) : trimmed;
}
