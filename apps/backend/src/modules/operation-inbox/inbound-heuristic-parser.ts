import { InboundMessage } from '@prisma/client';
import {
  mapInboundCategoryToMeridyen,
  mapInboundLossTypeToMeridyen,
  parseRemedSubjectLine,
  sanitizeInboundPhone,
  findInsuredMobilePhoneInText,
  collectInboundPlainText,
  extractInboundFormFields,
  getInboundFormFieldValue,
  INBOUND_ADDRESS_FIELD_LABELS,
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

/** AI çıktısı yokken konu/gövdeden müşteri ve dosya ipuçları çıkarır. */
export function extractHeuristicFields(
  message: Pick<InboundMessage, 'subject' | 'bodyText' | 'bodyPreview' | 'bodyHtml'>,
): HeuristicExtractedFields {
  const textForFields = collectInboundPlainText({
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    bodyPreview: message.bodyPreview,
  });
  const textForPhone = textForFields || (message.subject ? String(message.subject) : '');
  const fields = extractInboundFormFields(textForFields);
  const subjectHints = extractSubjectHints(message.subject);
  const remed = parseRemedSubjectLine(message.subject);

  const bodyLossType = getInboundFormFieldValue(fields, 'Hasar Şekli', 'Branş');
  const subjectCategory = remed?.rawCategory;
  const fileSubject =
    mapInboundCategoryToMeridyen(subjectCategory)
    ?? mapInboundCategoryToMeridyen(bodyLossType);
  const lossType =
    mapInboundLossTypeToMeridyen(bodyLossType)
    ?? (fileSubject && subjectCategory ? mapInboundLossTypeToMeridyen(subjectCategory) : undefined);

  const phoneFromFields = sanitizeInboundPhone(
    getInboundFormFieldValue(
      fields,
      'İletişim No',
      'Telefon',
      'Cep Telefonu',
      'GSM',
      'Sigortalı Telefonu',
    ),
  );

  return {
    customerName:
      getInboundFormFieldValue(fields, 'Sigorta Ettiren Ad-Soyad', 'Sigorta Ettiren')
      ?? remed?.customerName
      ?? undefined,
    phone: phoneFromFields ?? findInsuredMobilePhoneInText(textForPhone) ?? undefined,
    policyNo: getInboundFormFieldValue(fields, 'Poliçe No') ?? subjectHints.policyNo ?? remed?.policyNo,
    fileNo: getInboundFormFieldValue(fields, 'Dosya No') ?? remed?.remedFileNo,
    claimNo: getInboundFormFieldValue(fields, 'Referans No') ?? remed?.policyNo,
    address: getInboundFormFieldValue(fields, ...INBOUND_ADDRESS_FIELD_LABELS),
    lossType: lossType ?? undefined,
    fileSubject: fileSubject ?? undefined,
  };
}
