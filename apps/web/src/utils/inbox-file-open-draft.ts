import {
  parseInboundEmailContent,
  resolveAssistantFirmLabel,
  type ParsedInboxEmailContent,
} from '@/utils/inbound-email-content-parser';
import {
  mapInboundCategoryKnown,
  mapInboundLossTypeToMeridyen,
  sanitizeInboundPhone,
} from '@sigorta/shared';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { resolveInboundFileNo } from '@sigorta/shared';

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
  fileNoWarning?: string;
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

/** Müşteri dili → Meridyen dosya konusu (Cam Kırığı → Cam Kırılması). */
function lockMeridyenLossLabel(raw?: string | null): string {
  const t = raw?.trim();
  if (!t) return '';
  return (
    mapInboundLossTypeToMeridyen(t)
    ?? mapInboundCategoryKnown(t)
    ?? toTitleCaseTR(t)
  );
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
  const insuredPhoneRaw = mergePhoneField(parsed.phone, mf?.insuredPhone, routing?.insuredPhone);
  const fileNoRaw = mergeField(mf?.fileNo, parsed.fileNo);
  const claimNoRaw = mergeField(mf?.claimNo, parsed.policyNo, parsed.claimNo);
  const policyNoRaw = mergeField(mf?.policyNo, parsed.policyNo);
  const addressRaw = mergeField(parsed.address, mf?.insuredAddress);
  const fileSubjectRaw = mergeField(mf?.fileSubject, parsed.fileSubject);
  const lossTypeRaw = mergeField(mf?.lossType, parsed.category);
  const insurerRaw = mergeField(mf?.insurer, parsed.insurer);
  const resolvedFileNo = resolveInboundFileNo({
    bodyFileNo: fileNoRaw,
    insurer: insurerRaw,
    subject: message.subject,
    policyNo: policyNoRaw,
  });

  const draft: InboxFileOpenDraft = {
    subject: message.subject.trim(),
    formTitle: parsed.formTitle ? toTitleCaseTR(parsed.formTitle) : undefined,
    assistantFirm: resolveAssistantFirmLabel(parsed.senderProfile),
    senderPerson: message.fromName?.trim() ? toTitleCaseTR(message.fromName.trim()) : undefined,
    senderEmail: message.fromAddress.trim().toLowerCase(),
    aiSummary: message.aiSummary?.trim() || undefined,
    insurer: insurerRaw ? toTitleCaseTR(insurerRaw) : undefined,
    fileNo: resolvedFileNo.fileNo ?? '',
    fileNoWarning: parsed.fileNoWarning ?? resolvedFileNo.warning ?? undefined,
    claimNo: claimNoRaw,
    policyNo: policyNoRaw,
    lossType: lockMeridyenLossLabel(lossTypeRaw),
    fileSubject: lockMeridyenLossLabel(fileSubjectRaw),
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
  const insurer = fields.insurer?.trim()
    ? toTitleCaseTR(fields.insurer.trim())
    : draft.insurer;
  const policyNo = fields.policyNo?.trim() || draft.policyNo;
  const resolvedFileNo = resolveInboundFileNo({
    bodyFileNo: fields.fileNo?.trim() || draft.fileNo,
    insurer,
    subject: draft.subject,
    policyNo,
  });
  return {
    ...draft,
    insuredName: fields.insuredName?.trim()
      ? toTitleCaseTR(fields.insuredName.trim())
      : draft.insuredName,
    insuredPhone: sanitizeInboundPhone(fields.insuredPhone?.trim()) || draft.insuredPhone,
    insuredAddress: fields.insuredAddress?.trim()
      ? toTitleCaseTR(fields.insuredAddress.trim())
      : draft.insuredAddress,
    fileNo: resolvedFileNo.fileNo ?? '',
    fileNoWarning: resolvedFileNo.warning ?? draft.fileNoWarning,
    policyNo,
    claimNo: fields.claimNo?.trim() || draft.claimNo,
    lossType: fields.lossType?.trim()
      ? lockMeridyenLossLabel(fields.lossType.trim())
      : draft.lossType,
    fileSubject: fields.fileSubject?.trim()
      ? lockMeridyenLossLabel(fields.fileSubject.trim())
      : draft.fileSubject,
    insurer,
    manualFallback: false,
  };
}
