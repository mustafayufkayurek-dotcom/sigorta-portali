/**
 * Türkçe karakter destekli Title Case dönüştürücü.
 * "mustafa yufkayürek" → "Mustafa Yufkayürek"
 * "MUSTAFA YUFKAYÜREK" → "Mustafa Yufkayürek"
 *
 * Idempotent: Zaten düzgün biçimlendirilmiş metni yeniden işlese de aynı çıktıyı üretir.
 */
export function toTitleCaseTR(str: string): string {
  if (!str) return str;
  const lowerMap: Record<string, string> = {
    'I': 'ı', 'İ': 'i', 'Ğ': 'ğ', 'Ü': 'ü', 'Ş': 'ş', 'Ö': 'ö', 'Ç': 'ç',
  };
  const upperMap: Record<string, string> = {
    'ı': 'I', 'i': 'İ', 'ğ': 'Ğ', 'ü': 'Ü', 'ş': 'Ş', 'ö': 'Ö', 'ç': 'Ç',
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
