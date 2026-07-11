import {
  parseInboundEmailContent,
  resolveAssistantFirmLabel,
  type ParsedInboxEmailContent,
} from '@/utils/inbound-email-content-parser';
import { sanitizeInboundPhone } from '@sigorta/shared';
import { toTitleCaseTR } from '@/utils/text-helpers';

export interface InboxMailFields {
  insuredName?: string | null;
  insuredPhone?: string | null;
  insuredAddress?: string | null;
  fileNo?: string | null;
  policyNo?: string | null;
  claimNo?: string | null;
  lossType?: string | null;
  fileSubject?: string | null;
  insurer?: string | null;
}

export interface InboxFileOpenDraft {
  subject: string;
  formTitle?: string;
  assistantFirm?: string;
  senderPerson?: string;
  senderEmail: string;
  aiSummary?: string;
  insurer?: string;
  fileNo: string;
  claimNo: string;
  policyNo: string;
  lossType: string;
  fileSubject: string;
  insuredName: string;
  insuredPhone: string;
  insuredAddress: string;
  description?: string;
  /** Mail okunamadıysa true — tüm alanlar manuel doldurulabilir */
  manualFallback?: boolean;
}

interface MessageLike {
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  bodyPreview?: string | null;
  aiSummary?: string | null;
}

interface RoutingLike {
  insuredName?: string | null;
  insuredPhone?: string | null;
  mailFields?: InboxMailFields | null;
}

function mergePhoneField(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const sanitized = sanitizeInboundPhone(v);
    if (sanitized) return sanitized;
  }
  return '';
}

function mergeField(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

export function buildInboxFileOpenDraft(
  message: MessageLike,
  routing?: RoutingLike | null,
  options?: { manualFallback?: boolean },
): { parsed: ParsedInboxEmailContent; draft: InboxFileOpenDraft } {
  const parsed = parseInboundEmailContent({
    subject: message.subject,
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    bodyPreview: message.bodyPreview,
    fromAddress: message.fromAddress,
  });

  const mf = routing?.mailFields;
  const insuredNameRaw = mergeField(mf?.insuredName, routing?.insuredName, parsed.customerName);
  const insuredPhoneRaw = mergePhoneField(mf?.insuredPhone, routing?.insuredPhone, parsed.phone);
  const fileNoRaw = mergeField(mf?.fileNo, parsed.fileNo);
  const claimNoRaw = mergeField(mf?.claimNo, parsed.policyNo, parsed.claimNo);
  const policyNoRaw = mergeField(mf?.policyNo, parsed.policyNo);
  const addressRaw = mergeField(mf?.insuredAddress, parsed.address);
  const fileSubjectRaw = mergeField(mf?.fileSubject, parsed.fileSubject);
  const lossTypeRaw = mergeField(mf?.lossType, parsed.category);
  const insurerRaw = mergeField(mf?.insurer, parsed.insurer);

  const draft: InboxFileOpenDraft = {
    subject: message.subject.trim(),
    formTitle: parsed.formTitle ? toTitleCaseTR(parsed.formTitle) : undefined,
    assistantFirm: resolveAssistantFirmLabel(parsed.senderProfile),
    senderPerson: message.fromName?.trim() ? toTitleCaseTR(message.fromName.trim()) : undefined,
    senderEmail: message.fromAddress.trim().toLowerCase(),
    aiSummary: message.aiSummary?.trim() || undefined,
    insurer: insurerRaw ? toTitleCaseTR(insurerRaw) : undefined,
    fileNo: fileNoRaw,
    claimNo: claimNoRaw,
    policyNo: policyNoRaw,
    lossType: lossTypeRaw ? toTitleCaseTR(lossTypeRaw) : '',
    fileSubject: fileSubjectRaw ? toTitleCaseTR(fileSubjectRaw) : '',
    insuredName: insuredNameRaw ? toTitleCaseTR(insuredNameRaw) : '',
    insuredPhone: insuredPhoneRaw,
    insuredAddress: addressRaw ? toTitleCaseTR(addressRaw) : '',
    description: parsed.description?.trim() || undefined,
    manualFallback: options?.manualFallback,
  };

  return { parsed, draft };
}

/** Liste satırından anında açılabilir minimal taslak (API beklemeden). */
export function buildInboxFileOpenDraftFromRow(row: {
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  aiSummary?: string | null;
}): InboxFileOpenDraft {
  return buildInboxFileOpenDraft(row, null).draft;
}

export function applyMailFieldsToDraft(
  draft: InboxFileOpenDraft,
  fields: InboxMailFields,
): InboxFileOpenDraft {
  return {
    ...draft,
    insuredName: fields.insuredName?.trim()
      ? toTitleCaseTR(fields.insuredName.trim())
      : draft.insuredName,
    insuredPhone: sanitizeInboundPhone(fields.insuredPhone?.trim()) || draft.insuredPhone,
    insuredAddress: fields.insuredAddress?.trim()
      ? toTitleCaseTR(fields.insuredAddress.trim())
      : draft.insuredAddress,
    fileNo: fields.fileNo?.trim() || draft.fileNo,
    policyNo: fields.policyNo?.trim() || draft.policyNo,
    claimNo: fields.claimNo?.trim() || draft.claimNo,
    lossType: fields.lossType?.trim()
      ? toTitleCaseTR(fields.lossType.trim())
      : draft.lossType,
    fileSubject: fields.fileSubject?.trim()
      ? toTitleCaseTR(fields.fileSubject.trim())
      : draft.fileSubject,
    insurer: fields.insurer?.trim()
      ? toTitleCaseTR(fields.insurer.trim())
      : draft.insurer,
    manualFallback: false,
  };
}
