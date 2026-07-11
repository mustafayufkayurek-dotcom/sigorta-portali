import { InboundMessage } from '@prisma/client';
import {
  mapInboundCategoryToMeridyen,
  mapInboundLossTypeToMeridyen,
  parseRemedSubjectLine,
  sanitizeInboundPhone,
  findInsuredMobilePhoneInText,
} from '@sigorta/shared';
import { extractSubjectHints } from './inbound-subject-parser';

export interface HeuristicExtractedFields {
  customerName?: string | null;
  phone?: string | null;
  policyNo?: string | null;
  fileNo?: string | null;
  claimNo?: string | null;
  address?: string | null;
  lossType?: string | null;
  fileSubject?: string | null;
}

function decodeText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickField(text: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}\\s*:\\s*([^:]+?)(?=\\s+[\\p{L}][\\p{L}\\s\\-]*\\s*:|$)`, 'iu'));
  return match?.[1]?.trim() || undefined;
}

/** AI çıktısı yokken konu/gövdeden müşteri ve dosya ipuçları çıkarır. */
export function extractHeuristicFields(
  message: Pick<InboundMessage, 'subject' | 'bodyText' | 'bodyPreview' | 'bodyHtml'>,
): HeuristicExtractedFields {
  const bodyFromHtml = message.bodyHtml ? decodeText(message.bodyHtml) : '';
  const text = decodeText(
    [message.bodyText, bodyFromHtml, message.bodyPreview, message.subject].filter(Boolean).join(' '),
  );
  const subjectHints = extractSubjectHints(message.subject);
  const remed = parseRemedSubjectLine(message.subject);

  const bodyLossType = pickField(text, 'Hasar Şekli') ?? pickField(text, 'Branş');
  const subjectCategory = remed?.rawCategory;
  const fileSubject =
    mapInboundCategoryToMeridyen(subjectCategory)
    ?? mapInboundCategoryToMeridyen(bodyLossType);
  const lossType =
    mapInboundLossTypeToMeridyen(bodyLossType)
    ?? (fileSubject && subjectCategory ? mapInboundLossTypeToMeridyen(subjectCategory) : undefined);

  return {
    customerName:
      pickField(text, 'Sigorta Ettiren Ad-Soyad')
      ?? pickField(text, 'Sigorta Ettiren')
      ?? remed?.customerName
      ?? undefined,
    phone:
      sanitizeInboundPhone(
        pickField(text, 'İletişim No')
        ?? pickField(text, 'Telefon')
        ?? pickField(text, 'Cep Telefonu')
        ?? pickField(text, 'GSM'),
      )
      ?? findInsuredMobilePhoneInText(text)
      ?? undefined,
    policyNo: pickField(text, 'Poliçe No') ?? subjectHints.policyNo ?? remed?.policyNo,
    fileNo: pickField(text, 'Dosya No') ?? remed?.remedFileNo,
    claimNo: pickField(text, 'Referans No') ?? remed?.policyNo,
    address:
      pickField(text, 'Adres')
      ?? pickField(text, 'Hasar Yeri')
      ?? pickField(text, 'Sigorta Ettiren Adresi')
      ?? pickField(text, 'İletişim Adresi'),
    lossType: lossType ?? undefined,
    fileSubject: fileSubject ?? undefined,
  };
}
