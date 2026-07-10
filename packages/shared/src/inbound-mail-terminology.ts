/**
 * Gelen kutusu mail terminolojisini Meridyen yazım diline çevirir.
 * Remed / asistan firma konu satırı ve form alanları için.
 */

export interface RemedSubjectParts {
  policyNo?: string;
  customerName?: string;
  remedFileNo?: string;
  rawCategory?: string;
  fileSubject?: string;
}

const REPLY_PREFIX = /^(?:(?:Ynt|Re|Fwd|İlt|Yanıt):\s*)+/i;

/** Konu satırı kategori kodları → Meridyen dosya konusu */
const CATEGORY_ALIASES: Record<string, string> = {
  'KONUT CAM': 'Konut Cam',
  'KONUT HASAR': 'Konut Hasar',
  'KONUT': 'Konut',
  TESISAT: 'Tesisat',
  'KAPI KILIT': 'Kapı/Kilit Arızası',
  'KAPI/KILIT': 'Kapı/Kilit Arızası',
  ELEKTRIK: 'Elektrik Arızası',
  DOGALGAZ: 'Doğalgaz Arızası',
  'SU BASKINI': 'Su Baskını',
  'CATI HASARI': 'Çatı Hasarı',
  YANGIN: 'Yangın Hasarı',
};

/** Hasar şekli / açıklama eşanlamlıları → Title Case Meridyen terimi */
const LOSS_TYPE_ALIASES: Record<string, string> = {
  'cam kirilmasi': 'Cam Kırılması',
  'cam kırılması': 'Cam Kırılması',
  'cam kirigi': 'Cam Kırığı',
  'konut cam': 'Konut Cam',
  'konut hasar': 'Konut Hasar',
  tesisat: 'Tesisat',
  'kapi kilit': 'Kapı/Kilit Arızası',
  elektrik: 'Elektrik Arızası',
  dogalgaz: 'Doğalgaz Arızası',
};

function collapseKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function collapseAliasKey(value: string): string {
  return collapseKey(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function titleCaseTokenTR(token: string): string {
  if (!token) return token;
  const lower = token.toLocaleLowerCase('tr-TR');
  return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
}

/** Basit Türkçe Title Case — shared pakette web bağımlılığı olmadan */
export function toInboundTitleCaseTR(value: string): string {
  const trimmed = collapseKey(value);
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => titleCaseTokenTR(word))
    .join(' ');
}

export function mapInboundCategoryToMeridyen(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const collapsed = collapseKey(raw);
  const upper = collapsed.toLocaleUpperCase('tr-TR');
  if (CATEGORY_ALIASES[upper]) return CATEGORY_ALIASES[upper];
  if (upper.includes('KONUT') && upper.includes('CAM')) return 'Konut Cam';
  if (upper.includes('TESISAT')) return 'Tesisat';
  return toInboundTitleCaseTR(collapsed);
}

export function mapInboundLossTypeToMeridyen(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const aliasKey = collapseAliasKey(raw);
  if (LOSS_TYPE_ALIASES[aliasKey]) return LOSS_TYPE_ALIASES[aliasKey];
  const category = mapInboundCategoryToMeridyen(raw);
  if (category && aliasKey.includes('cam')) return 'Cam Kırılması';
  return toInboundTitleCaseTR(raw);
}

/**
 * Remed tipik konu: POLİÇE/AD SOYAD/RCS-XXXXXXXXX/KONUT CAM
 */
export function parseRemedSubjectLine(subject: string): RemedSubjectParts | undefined {
  const cleaned = subject.replace(REPLY_PREFIX, '').trim();
  const parts = cleaned.split('/').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return undefined;

  const policyNo = /^\d{6,12}$/.test(parts[0]) ? parts[0] : undefined;
  const remedFileNo = parts.find((p) => /^RCS-/i.test(p));
  const customerName =
    parts[1] && parts[1] !== remedFileNo && !/^RCS-/i.test(parts[1])
      ? parts[1]
      : undefined;

  const rawCategory = parts.find(
    (p) =>
      p !== policyNo
      && p !== customerName
      && p !== remedFileNo
      && !/^\d+$/.test(p),
  );

  return {
    policyNo,
    customerName,
    remedFileNo: remedFileNo ? remedFileNo.toUpperCase().replace(/\s+/g, '') : undefined,
    rawCategory,
    fileSubject: mapInboundCategoryToMeridyen(rawCategory),
  };
}

/** Placeholder veya anlamsız telefon değerlerini filtreler */
export function sanitizeInboundPhone(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const value = raw.trim();
  const lower = value.toLocaleLowerCase('tr-TR');
  if (
    lower.includes('mail formundan')
    || lower.includes('belirtilmemiş')
    || lower === '—'
    || lower === '-'
  ) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  return value;
}
