/** Kod/slug veya hatalı yazım → ekranda duracak Meridyen adı. */
const CANONICAL: Record<string, string> = {
  'konut yangin': 'Konut-Yangın',
  'konut yangini': 'Konut-Yangın',
  'endustriyel yangin': 'Endüstriyel-Yangın',
  'endustriyel yangini': 'Endüstriyel-Yangın',
};

const TOKEN_TR: Record<string, string> = {
  yangin: 'yangın',
  yangini: 'yangını',
  endustriyel: 'endüstriyel',
  hirsizlik: 'hırsızlık',
  firtina: 'fırtına',
  sihhi: 'sıhhi',
  dogal: 'doğal',
  cati: 'çatı',
  kirilmasi: 'kırılması',
  kirigi: 'kırığı',
  onarim: 'onarım',
};

function foldKey(value: string): string {
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
    .replace(/ç/g, 'c')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function restoreTrTokens(value: string): string {
  return value
    .split(/(\s+|-+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || /^-+$/.test(part)) return part;
      const folded = foldKey(part);
      return TOKEN_TR[folded] ?? part;
    })
    .join('');
}

function titleCaseTokenTR(token: string): string {
  if (!token) return token;
  const lower = token.toLocaleLowerCase('tr-TR');
  return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
}

function toTitleCaseWordsTR(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => titleCaseTokenTR(word))
    .join(' ');
}

function titleCasePreservingHyphen(value: string): string {
  return value
    .split(/(-)/)
    .map((part) => (part === '-' ? part : toTitleCaseWordsTR(part)))
    .join('');
}

function hyphenateKnownCompounds(value: string): string {
  return value
    .replace(/\bKonut Yangın(?:ı)?\b/giu, 'Konut-Yangın')
    .replace(/\bEndüstriyel Yangın(?:ı)?\b/giu, 'Endüstriyel-Yangın')
    .replace(/\bEndustriyel Yangın(?:ı)?\b/giu, 'Endüstriyel-Yangın');
}

/** `konut-yangin` / `HASAR_ONARIM` kodu; `Sel-Seylap` gibi başlıklı ad değil. */
function shouldSplitCode(value: string): boolean {
  if (/\s/.test(value) || !/[-_]/.test(value)) return false;
  if (value === value.toLocaleUpperCase('tr-TR') && /_/.test(value)) return true;
  return value === value.toLocaleLowerCase('en-US');
}

/**
 * Kullanıcıya gösterilen ad.
 * `konut-yangin` / `Konut Yangın` → `Konut-Yangın`
 */
export function formatMeridyenDisplayLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '—';
  const folded = foldKey(trimmed);
  if (CANONICAL[folded]) return CANONICAL[folded];

  const working = shouldSplitCode(trimmed) ? trimmed.replace(/[-_]+/g, ' ') : trimmed;
  const titled = titleCasePreservingHyphen(restoreTrTokens(working));
  return hyphenateKnownCompounds(titled);
}
