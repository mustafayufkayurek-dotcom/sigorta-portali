/**
 * Gelen kutusu mail terminolojisini Meridyen yazım diline çevirir.
 * Remed / asistan firma konu satırı ve form alanları için.
 */

import {
  extractInboundFormFields,
  getInboundFormFieldValue,
  sliceInboundFormBody,
} from './inbound-form-fields';

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
  'SIHHI TESISAT': 'Sıhhi Tesisat',
  'KAPI KILIT': 'Kapı/Kilit Arızası',
  'KAPI/KILIT': 'Kapı/Kilit Arızası',
  ELEKTRIK: 'Elektrik Arızası',
  DOGALGAZ: 'Doğalgaz Arızası',
  // İhbar mailindeki "Su Baskını" → Meridyen dosya konusu
  'SU BASKINI': 'Dahili Su',
  'CATI HASARI': 'Çatı Hasarı',
  YANGIN: 'Yangın Hasarı',
};

/** Hasar şekli / açıklama eşanlamlıları → Title Case Meridyen terimi */
const LOSS_TYPE_ALIASES: Record<string, string> = {
  'cam kirilmasi': 'Cam Kırılması',
  'cam kırılması': 'Cam Kırılması',
  // Müşteri dili (Cam Kırığı) → Meridyen Dosya Konusu — kilitli
  'cam kirigi': 'Cam Kırılması',
  'cam kırığı': 'Cam Kırılması',
  'cam kirik': 'Cam Kırılması',
  'cam kırık': 'Cam Kırılması',
  'cam kirigi hasari': 'Cam Kırılması',
  'cam kırığı hasarı': 'Cam Kırılması',
  'sihhi tesisat': 'Sıhhi Tesisat',
  'vam kirilmasi': 'Cam Kırılması',
  'vam kırılması': 'Cam Kırılması',
  'vam kirilmas': 'Cam Kırılması',
  'vam kirigi': 'Cam Kırılması',
  'dahili su': 'Dahili Su',
  // İhbar / müşteri dili → Meridyen terminolojisi
  'su baskini': 'Dahili Su',
  'su baskını': 'Dahili Su',
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
    .replace(/[\u0300-\u036f]/g, '')
    // Türkçe ı NFD ile düşmez; alias lookup ASCII anahtarlarla hizalanır.
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
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

/** Yalnızca bilinen kategori eşlemesi — serbest metin Title Case'e çevrilmez */
export function mapInboundCategoryKnown(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const collapsed = collapseKey(raw);
  const upper = collapsed.toLocaleUpperCase('tr-TR');
  if (CATEGORY_ALIASES[upper]) return CATEGORY_ALIASES[upper];
  if (upper.includes('KONUT') && upper.includes('CAM')) return 'Konut Cam';
  if (upper.includes('SIHH') && (upper.includes('TESISAT') || upper.includes('TESİSAT'))) {
    return 'Sıhhi Tesisat';
  }
  if (upper.includes('TESISAT') || upper.includes('TESİSAT')) return 'Tesisat';
  return undefined;
}

export function mapInboundCategoryToMeridyen(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const known = mapInboundCategoryKnown(raw);
  if (known) return known;
  return toInboundTitleCaseTR(collapseKey(raw));
}

/** Katalogdaki dosya konusu ile mail/alias metnini hizalar (Tesisat → Sıhhi Tesisat). */
export function matchCatalogFileSubject(raw: string, catalog: string[]): string {
  const t = raw.trim();
  if (!t) return '';
  if (catalog.length === 0) return t;
  const fold = (s: string) => s.toLocaleLowerCase('tr-TR');
  const foldedRaw = fold(t);
  const exact = catalog.find((c) => fold(c) === foldedRaw);
  if (exact) return exact;
  if (foldedRaw === 'tesisat') {
    const sihhi = catalog.find((c) => {
      const f = fold(c);
      return f.includes('sıhhi') && f.includes('tesisat');
    });
    if (sihhi) return sihhi;
  }
  const contains = catalog.find((c) => {
    const f = fold(c);
    return foldedRaw.length >= 4 && f.includes(foldedRaw);
  });
  return contains ?? t;
}

/** Serbest metin ihbar notu mu (canonical konu değil) */
export function isInboundIhbarNoteText(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (/^gelen kutusu ihbar/i.test(trimmed)) return true;
  if (trimmed.length > 48) return true;
  if (/[.!?;:]/.test(trimmed) && trimmed.length > 24) return true;
  return /\b(mutfak|branş|brans|patlam|açıklama|aciklama|notu|tespit|hasar yeri|detay|sigortalı|sigortali|dolap|dolabi|buzdolab|ankastre|tesisat ar|su kaç|sızınt|sizint)\b/i.test(trimmed);
}

export function mapInboundLossTypeToMeridyen(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  if (isInboundIhbarNoteText(raw)) return undefined;
  const aliasKey = collapseAliasKey(raw);
  if (LOSS_TYPE_ALIASES[aliasKey]) return LOSS_TYPE_ALIASES[aliasKey];
  const category = mapInboundCategoryKnown(raw);
  if (category) return category;
  if (aliasKey.includes('vam') && aliasKey.includes('kir')) return 'Cam Kırılması';
  // cam + kırık/kırıl/kırı — müşteri dili kilitli
  if (
    aliasKey.includes('cam')
    && (aliasKey.includes('kir') || aliasKey.includes('kirik') || aliasKey.includes('kiril'))
  ) {
    return 'Cam Kırılması';
  }
  if (aliasKey.includes('dahili') && aliasKey.includes('su')) return 'Dahili Su';
  // "Su Baskını" / "su baskini" ihbar dili → Meridyen: Dahili Su
  // "Sel" içeren doğal afet ifadeleri bu eşlemeye girmez.
  if (
    aliasKey.includes('su') &&
    aliasKey.includes('baskin') &&
    !aliasKey.includes('sel')
  ) {
    return 'Dahili Su';
  }
  return undefined;
}

/**
 * Kanonik etikete giden bilinen alias varyantları (okuma-zamanı filtre genişletme).
 * Orijinal metni silmez; yalnızca eşleşen anahtarları listeler.
 */
export function listInboundAliasVariantsForCanonical(canonical?: string | null): string[] {
  if (!canonical?.trim()) return [];
  const target = collapseKey(canonical);
  const targetAlias = collapseAliasKey(canonical);
  const variants = new Set<string>([target]);

  for (const [alias, mapped] of Object.entries(LOSS_TYPE_ALIASES)) {
    if (collapseAliasKey(mapped) !== targetAlias) continue;
    variants.add(mapped);
    variants.add(alias);
    variants.add(toInboundTitleCaseTR(alias));
  }
  for (const [alias, mapped] of Object.entries(CATEGORY_ALIASES)) {
    if (collapseAliasKey(mapped) !== targetAlias) continue;
    variants.add(mapped);
    variants.add(alias);
    variants.add(toInboundTitleCaseTR(alias));
  }
  return [...variants];
}

/** Serbest metin için sync kanonik etiket (DB yok) — eşleşmezse null */
export function resolveInboundCanonicalLabel(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  if (isInboundIhbarNoteText(raw)) return null;
  return mapInboundLossTypeToMeridyen(raw) ?? mapInboundCategoryKnown(raw) ?? null;
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

/** 0850 / 444 hatları sigortalı GSM değildir — form şablonunda çağrı merkezi basılır */
export function isInboundCallCenterPhone(raw?: string | null): boolean {
  if (!raw?.trim()) return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return false;
  const normalized = digits.startsWith('0') ? digits : `0${digits}`;
  if (normalized.startsWith('0850') || normalized.startsWith('444')) return true;
  // 850 XXX XX XX (başında 0 olmadan)
  if (/^850\d{7}$/.test(digits)) return true;
  return false;
}

/** Etiketli form alanından sigortalı GSM çıkarır. */
const PHONE_FIELD_LABELS = [
  'İletişim No',
  'Telefon',
  'Cep Telefonu',
  'GSM',
  'Sigortalı Telefonu',
];

export function findLabeledInsuredPhoneInText(text?: string | null): string | undefined {
  if (!text?.trim()) return undefined;
  const formBody = sliceInboundFormBody(text);
  const fields = extractInboundFormFields(formBody);
  const raw = getInboundFormFieldValue(fields, ...PHONE_FIELD_LABELS);
  return sanitizeInboundPhone(raw);
}

/** Metin içinde sigortalıya ait GSM — önce form etiketi, sonra form gövdesi taraması. */
export function findInsuredMobilePhoneInText(text?: string | null): string | undefined {
  if (!text?.trim()) return undefined;

  const labeled = findLabeledInsuredPhoneInText(text);
  if (labeled) return labeled;

  const formBody = sliceInboundFormBody(text);
  const scanTarget = formBody.trim();
  if (!scanTarget) return undefined;

  const matches = scanTarget.matchAll(
    /(?:^|\D)(0?5\d{2})[\s.-]?(\d{3})[\s.-]?(\d{2})[\s.-]?(\d{2})(?=\D|$)/g,
  );
  for (const match of matches) {
    const candidate = sanitizeInboundPhone(match[0].trim());
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Gelen kutusu sigortalı telefonu — öncelik: form/heuristic, etiketli alan, form gövdesi taraması, AI.
 * Gönderen/eksper numarası veya yanıt zinciri ASLA fallback olmamalı.
 */
export function resolveInsuredPhoneForInbox(input: {
  heuristicPhone?: string | null;
  extractedPhone?: string | null;
  bodyText?: string | null;
}): string | undefined {
  const heuristic = sanitizeInboundPhone(input.heuristicPhone);
  if (heuristic) return heuristic;

  const labeled = findLabeledInsuredPhoneInText(input.bodyText);
  if (labeled) return labeled;

  const scanned = findInsuredMobilePhoneInText(input.bodyText);
  if (scanned) return scanned;

  return sanitizeInboundPhone(input.extractedPhone);
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
  if (isInboundCallCenterPhone(value)) return undefined;
  return value;
}
