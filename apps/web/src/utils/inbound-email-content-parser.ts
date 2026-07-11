/** E-posta gövdesi ve konusundan okunabilir alanlar çıkarır (Remed / sigorta ihbar formları). */

import {
  mapInboundCategoryToMeridyen,
  mapInboundLossTypeToMeridyen,
  parseRemedSubjectLine,
  sanitizeInboundPhone,
  findInsuredMobilePhoneInText,
  decodeInboundEmailText,
  extractInboundFormFields,
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

const FORM_TITLE_PATTERN =
  /\b(KONUT HASAR İHBAR FORMU|HASAR İHBAR FORMU|ACİL YARDIM İHBAR FORMU|İHBAR FORMU)\b/i;

/** HTML entity ve nbsp temizliği. */
export function decodeEmailText(raw: string): string {
  return decodeInboundEmailText(raw);
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
  return extractInboundFormFields(text);
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

  const phoneFromFields = sanitizeInboundPhone(
    fieldMap.get('i̇letişim no')
    ?? fieldMap.get('iletisim no')
    ?? fieldMap.get('telefon')
    ?? fieldMap.get('cep telefonu')
    ?? fieldMap.get('gsm')
    ?? fieldMap.get('sigortalı telefonu')
    ?? fieldMap.get('sigortali telefonu'),
  );
  const phone = phoneFromFields ?? findInsuredMobilePhoneInText(text);

  const fileNo = fieldMap.get('dosya no') ?? subjectParts?.remedFileNo ?? subjectParts?.claimNo;
  const policyNo = fieldMap.get('poliçe no') ?? subjectParts?.fileOrPolicyNo;
  const claimRaw = fieldMap.get('referans no') ?? subjectParts?.fileOrPolicyNo ?? subjectParts?.remedFileNo;
  const claimNo = normalizeClaimNo(claimRaw);
  const address =
    fieldMap.get('adres')
    ?? fieldMap.get('hasar yeri')
    ?? fieldMap.get('sigorta ettiren adresi')
    ?? fieldMap.get('sigortalı adresi')
    ?? fieldMap.get('sigortali adresi')
    ?? fieldMap.get('hasar adresi')
    ?? fieldMap.get('i̇letişim adresi')
    ?? fieldMap.get('iletisim adresi');
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
