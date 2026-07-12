import { isInboundIhbarNoteText, mapInboundCategoryKnown, mapInboundLossTypeToMeridyen } from '@sigorta/shared';

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

/**
 * API kod/slug alanlarını kullanıcıya gösterilecek Title Case metne çevirir.
 * "endustriyel-yangin" → "Endustriyel Yangın", "HASAR_ONARIM" → "Hasar Onarım"
 */
export function formatDisplayLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '—';
  const spaced = trimmed.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  return toTitleCaseTR(spaced);
}

export type ClaimIhbarKonusuSource = {
  lossType?: string | null;
  productBranch?: string | null;
  claimSubject?: { name?: string | null } | null;
  departmentFileSubject?: { name?: string | null } | null;
};

export function resolveClaimIhbarKonusu(claim: ClaimIhbarKonusuSource): string {
  return resolveClaimDosyaKonusu(claim);
}

/**
 * Dosya konusu — Ayarlar → Dosya Konuları kanonik adı öncelikli.
 * Müşteri/personel hatalı serbest metin girmişse katalog veya terminoloji eşlemesiyle düzeltilir.
 */
export function resolveClaimDosyaKonusu(
  claim: ClaimIhbarKonusuSource,
  catalogNames?: string[],
): string {
  const deptName = claim.departmentFileSubject?.name?.trim();
  if (deptName && !isInboundIhbarNoteText(deptName)) {
    return matchCatalogName(deptName, catalogNames) ?? toTitleCaseTR(deptName);
  }

  const subjectName = claim.claimSubject?.name?.trim();
  if (subjectName && !isInboundIhbarNoteText(subjectName)) {
    return matchCatalogName(subjectName, catalogNames) ?? toTitleCaseTR(subjectName);
  }

  const lossRaw = claim.lossType?.trim();
  if (lossRaw && !isInboundIhbarNoteText(lossRaw)) {
    const fromCatalog = matchCatalogName(lossRaw, catalogNames);
    if (fromCatalog) return fromCatalog;

    const mapped =
      mapInboundLossTypeToMeridyen(lossRaw)
      ?? mapInboundCategoryKnown(lossRaw);
    if (mapped) return mapped;

    if (lossRaw.length <= 48 && !lossRaw.includes('\n')) {
      return formatDisplayLabel(lossRaw);
    }
  }

  return '—';
}

function matchCatalogName(raw: string, catalogNames?: string[]): string | undefined {
  if (!catalogNames?.length) return undefined;
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
  const key = norm(raw);
  const codeKey = sanitizeCode(raw);
  const hit = catalogNames.find((name) => {
    const n = norm(name);
    return n === key || sanitizeCode(name) === codeKey;
  });
  return hit ? toTitleCaseTR(hit) : undefined;
}

/** Hasar dosyası konu/branş etiketi — geriye dönük imza */
export function formatClaimSubjectLabel(
  lossType?: string | null,
  productBranch?: string | null,
  fallbackName?: string | null,
): string {
  return resolveClaimIhbarKonusu({
    lossType,
    productBranch,
    claimSubject: fallbackName ? { name: fallbackName } : null,
  });
}

/** Hasar adresi — sokak/metin önce, sonra İl · İlçe (eksikte Belirtilmemiş) */
export function formatHasarAdresi(propertyAddress?: {
  addressLine?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  city?: string | null;
} | null): string {
  if (!propertyAddress) return 'Belirtilmemiş';
  const street = propertyAddress.addressLine?.trim() || 'Belirtilmemiş';
  const city = propertyAddress.city?.trim() || 'Belirtilmemiş';
  const district = propertyAddress.district?.trim() || 'Belirtilmemiş';
  return `${street} · İl (${city}) · İlçe (${district})`;
}
