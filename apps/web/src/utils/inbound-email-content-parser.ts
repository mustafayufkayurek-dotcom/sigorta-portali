/** E-posta gövdesi ve konusundan okunabilir alanlar çıkarır (Remed / sigorta ihbar formları). */

import {
  mapInboundCategoryToMeridyen,
  mapInboundLossTypeToMeridyen,
  parseRemedSubjectLine,
  sanitizeInboundPhone,
} from '@sigorta/shared';

export type InboxSenderProfile = 'remed' | 'safran' | 'insurance' | 'unknown';

export interface ParsedSubjectParts {
  fileOrPolicyNo?: string;
  customerName?: string;
  claimNo?: string;
  remedFileNo?: string;
  category?: string;
  fileSubject?: string;
}

export interface ParsedFormField {
  label: string;
  value: string;
}

export interface ParsedInboxEmailContent {
  formTitle?: string;
  subjectParts?: ParsedSubjectParts;
  fields: ParsedFormField[];
  description?: string;
  notes: string[];
  senderProfile: InboxSenderProfile;
  customerName?: string;
  phone?: string;
  claimNo?: string;
  fileNo?: string;
  policyNo?: string;
  address?: string;
  insurer?: string;
  category?: string;
  fileSubject?: string;
}

const FORM_FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'insurer', label: 'Sigorta Şirketi' },
  { key: 'customerName', label: 'Sigorta Ettiren Ad-Soyad' },
  { key: 'customerNameAlt', label: 'Sigorta Ettiren' },
  { key: 'fileNo', label: 'Dosya No' },
  { key: 'policyNo', label: 'Poliçe No' },
  { key: 'claimNo', label: 'Referans No' },
  { key: 'phone', label: 'İletişim No' },
  { key: 'phoneAlt', label: 'Telefon' },
  { key: 'address', label: 'Adres' },
  { key: 'category', label: 'Hasar Şekli' },
  { key: 'categoryAlt', label: 'Branş' },
  { key: 'description', label: 'Açıklama' },
  { key: 'descriptionAlt', label: 'Hasar Açıklaması' },
];

const FORM_TITLE_PATTERN =
  /\b(KONUT HASAR İHBAR FORMU|HASAR İHBAR FORMU|ACİL YARDIM İHBAR FORMU|İHBAR FORMU)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** HTML entity ve nbsp temizliği. */
export function decodeEmailText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function parseSubjectParts(subject: string): ParsedSubjectParts | undefined {
  const remed = parseRemedSubjectLine(subject);
  if (!remed) return undefined;
  if (!remed.policyNo && !remed.customerName && !remed.remedFileNo) return undefined;
  return {
    fileOrPolicyNo: remed.policyNo,
    customerName: remed.customerName,
    remedFileNo: remed.remedFileNo,
    claimNo: remed.remedFileNo,
    category: remed.rawCategory,
    fileSubject: remed.fileSubject,
  };
}

function extractFormFields(text: string): ParsedFormField[] {
  const labels = [...FORM_FIELD_LABELS]
    .map((f) => f.label)
    .sort((a, b) => b.length - a.length);
  const labelGroup = labels.map(escapeRegex).join('|');
  const regex = new RegExp(`(${labelGroup})\\s*:\\s*`, 'gi');
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return [];

  const fields: ParsedFormField[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = match[1]?.trim();
    if (!label) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    let value = text.slice(start, end).trim();
    value = value.replace(/\s*Not\s*:\s*[\s\S]*$/i, '').trim();

    const displayLabel = FORM_FIELD_LABELS.find(
      (f) => f.label.toLowerCase() === label.toLowerCase(),
    )?.label ?? label;

    const dedupeKey = displayLabel.toLowerCase();
    if (value && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      fields.push({ label: displayLabel, value });
    }
  }

  return fields;
}

function extractNotes(text: string): string[] {
  const notes: string[] = [];
  const notMatch = text.match(/\bNot\s*:\s*([\s\S]+?)(?=\s+(?:KONUT HASAR|HASAR İHBAR|$))/i);
  if (notMatch?.[1]?.trim()) {
    notes.push(notMatch[1].trim());
  }
  return notes;
}

function normalizeClaimNo(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const digits = raw.replace(/^RCS-/i, '').trim();
  if (!digits) return undefined;
  return `RCS-${digits}`;
}

export function detectSenderProfile(fromAddress: string): InboxSenderProfile {
  const addr = fromAddress.toLowerCase();
  if (addr.includes('remed.com')) return 'remed';
  if (addr.includes('safranbh.com')) return 'safran';
  if (addr.includes('sigorta') || addr.includes('insurance')) return 'insurance';
  return 'unknown';
}

/** Asistan firma etiketi — gönderen profilinden (sigortalı değil). */
export function resolveAssistantFirmLabel(profile: InboxSenderProfile): string | undefined {
  switch (profile) {
    case 'remed':
      return 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.';
    case 'safran':
      return 'Safran Birleşik Hizmetler';
    default:
      return undefined;
  }
}

export function parseInboundEmailContent(input: {
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  bodyPreview?: string | null;
  fromAddress: string;
}): ParsedInboxEmailContent {
  const rawBody = input.bodyText?.trim()
    || (input.bodyHtml ? decodeEmailText(input.bodyHtml) : '')
    || input.bodyPreview?.trim()
    || '';
  const text = decodeEmailText(rawBody);
  const subjectParts = parseSubjectParts(input.subject);
  const formTitleMatch = text.match(FORM_TITLE_PATTERN);
  const fields = extractFormFields(text);
  const notes = extractNotes(text);

  const fieldMap = new Map<string, string>();
  for (const f of fields) {
    const key = f.label.toLowerCase();
    if (!fieldMap.has(key)) fieldMap.set(key, f.value);
  }

  const customerName =
    fieldMap.get('sigorta ettiren ad-soyad')
    ?? fieldMap.get('sigorta ettiren')
    ?? subjectParts?.customerName;

  const phone = sanitizeInboundPhone(
    fieldMap.get('i̇letişim no')
    ?? fieldMap.get('iletisim no')
    ?? fieldMap.get('telefon'),
  );

  const fileNo = fieldMap.get('dosya no') ?? subjectParts?.remedFileNo ?? subjectParts?.claimNo;
  const policyNo = fieldMap.get('poliçe no') ?? subjectParts?.fileOrPolicyNo;
  const claimRaw = fieldMap.get('referans no') ?? subjectParts?.fileOrPolicyNo ?? subjectParts?.remedFileNo;
  const claimNo = normalizeClaimNo(claimRaw);
  const address = fieldMap.get('adres');
  const insurer = fieldMap.get('sigorta şirketi');
  const bodyCategory = fieldMap.get('hasar şekli') ?? fieldMap.get('branş');
  const category = bodyCategory ?? subjectParts?.category;
  const fileSubject =
    subjectParts?.fileSubject
    ?? mapInboundCategoryToMeridyen(subjectParts?.category)
    ?? mapInboundCategoryToMeridyen(bodyCategory);
  const normalizedLossType = mapInboundLossTypeToMeridyen(bodyCategory) ?? mapInboundLossTypeToMeridyen(subjectParts?.category);
  const description = fieldMap.get('açıklama') ?? fieldMap.get('hasar açıklaması');

  return {
    formTitle: formTitleMatch?.[1],
    subjectParts,
    fields,
    description,
    notes,
    senderProfile: detectSenderProfile(input.fromAddress),
    customerName,
    phone,
    claimNo,
    fileNo,
    policyNo,
    address,
    insurer,
    category: normalizedLossType ?? category,
    fileSubject,
  };
}

/** Özet kartında gösterilecek birleşik alan listesi. */
export function buildSummaryFields(parsed: ParsedInboxEmailContent): ParsedFormField[] {
  const rows: ParsedFormField[] = [];
  const push = (label: string, value?: string | null) => {
    if (value?.trim()) rows.push({ label, value: value.trim() });
  };

  push('Form Türü', parsed.formTitle);
  push('Sigorta Şirketi', parsed.insurer);
  push('Sigorta Ettiren', parsed.customerName);
  push('Dosya No', parsed.fileNo);
  push('Referans No', parsed.claimNo);
  push('Poliçe No', parsed.policyNo);
  push('İletişim No', parsed.phone);
  push('Dosya Konusu', parsed.fileSubject);
  push('Hasar Şekli', parsed.category);
  push('Adres', parsed.address);
  push('Açıklama', parsed.description);

  for (const f of parsed.fields) {
    if (!rows.some((r) => r.label.toLowerCase() === f.label.toLowerCase())) {
      rows.push(f);
    }
  }

  return rows;
}
