import { InboundMessage } from '@prisma/client';
import { extractSubjectHints, stripReplyPrefixes } from './inbound-subject-parser';

export interface HeuristicExtractedFields {
  customerName?: string | null;
  phone?: string | null;
  policyNo?: string | null;
  fileNo?: string | null;
  claimNo?: string | null;
  address?: string | null;
  lossType?: string | null;
}

function decodeText(raw: string): string {
  return raw
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
export function extractHeuristicFields(message: Pick<InboundMessage, 'subject' | 'bodyText' | 'bodyPreview'>): HeuristicExtractedFields {
  const text = decodeText([message.bodyText, message.bodyPreview, message.subject].filter(Boolean).join(' '));
  const subjectHints = extractSubjectHints(message.subject);
  const subjectParts = stripReplyPrefixes(message.subject).split('/').map((s) => s.trim());

  return {
    customerName:
      pickField(text, 'Sigorta Ettiren Ad-Soyad')
      ?? pickField(text, 'Sigorta Ettiren')
      ?? (subjectParts[1]?.length > 2 ? subjectParts[1] : undefined),
    phone: pickField(text, 'İletişim No') ?? pickField(text, 'Telefon'),
    policyNo: pickField(text, 'Poliçe No') ?? subjectHints.policyNo ?? subjectParts[0],
    fileNo: pickField(text, 'Dosya No') ?? subjectParts[0],
    claimNo: pickField(text, 'Referans No') ?? subjectHints.claimNo,
    address: pickField(text, 'Adres'),
    lossType: pickField(text, 'Hasar Şekli') ?? pickField(text, 'Branş') ?? subjectParts.find(
      (s) => s !== subjectParts[0] && s !== subjectParts[1],
    ),
  };
}
