import { InboundClassification, InboundMailbox } from '@prisma/client';

export const INBOUND_CLASSIFY_SYSTEM = `Sen Türkiye sigorta/hasar operasyon asistanısın.
Gelen e-postayı sınıflandır ve YALNIZCA geçerli JSON döndür:
{
  "classification": "HASAR_IHBAR" | "ACIL_YARDIM" | "BELGE_TALEP" | "FATURA_ODEME" | "GENEL" | "SPAM" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "summary": "max 200 karakter Türkçe özet",
  "extracted": {
    "customerName": string | null,
    "phone": string | null,
    "policyNo": string | null,
    "fileNo": string | null,
    "plate": string | null,
    "claimNo": string | null,
    "address": string | null,
    "lossType": string | null,
    "urgency": "NORMAL" | "HIGH" | null
  },
  "suggestedAction": "OPEN_HASAR_FILE" | "OPEN_ACIL_FILE" | "LINK_EXISTING" | "REPLY_ONLY" | "ARCHIVE",
  "suggestedResponsibleRole": "office" | "field" | null
}
Kurallar: "vaka" değil "dosya" kullan. ihbar@ → genelde ihbar; hasar@ → hasar/evrak.`;

export interface InboundClassifyResult {
  classification: InboundClassification;
  confidence: number;
  summary: string;
  extracted: Record<string, unknown>;
  suggestedAction: string;
  suggestedResponsibleRole: string | null;
}

const VALID_CLASSIFICATIONS = new Set<InboundClassification>([
  'HASAR_IHBAR',
  'ACIL_YARDIM',
  'BELGE_TALEP',
  'FATURA_ODEME',
  'GENEL',
  'SPAM',
  'UNKNOWN',
]);

function stripHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildInboundClassifyUserContent(message: {
  mailbox: InboundMailbox;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  bodyPreview: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
}): string {
  const mailboxHint =
    message.mailbox === 'IHBAR'
      ? 'ihbar@ paylaşımlı kutu (acil yardım / ihbar)'
      : 'hasar@ paylaşımlı kutu (hasar evrak / belge)';
  const sender = message.fromName
    ? `${message.fromName} <${message.fromAddress}>`
    : message.fromAddress;
  const body =
    message.bodyText?.trim() ||
    message.bodyPreview?.trim() ||
    stripHtml(message.bodyHtml) ||
    '(İçerik yok)';

  return [
    `Kutu: ${mailboxHint}`,
    `Gönderen: ${sender}`,
    `Konu: ${message.subject}`,
    `Alınma: ${message.receivedAt.toISOString()}`,
    '',
    '--- E-posta gövdesi ---',
    body.slice(0, 6000),
  ].join('\n');
}

export function parseInboundClassifyResponse(text: string): InboundClassifyResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Model yanıtında JSON bulunamadı');
  }

  const raw = JSON.parse(match[0]) as Record<string, unknown>;

  const classificationRaw =
    typeof raw.classification === 'string' ? raw.classification.trim().toUpperCase() : 'UNKNOWN';
  const classification = VALID_CLASSIFICATIONS.has(classificationRaw as InboundClassification)
    ? (classificationRaw as InboundClassification)
    : 'UNKNOWN';

  let confidence = 0.5;
  if (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) {
    confidence = Math.min(1, Math.max(0, raw.confidence));
  }

  const summary =
    typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim().slice(0, 200)
      : 'Özet üretilemedi';

  const extracted =
    raw.extracted && typeof raw.extracted === 'object' && !Array.isArray(raw.extracted)
      ? (raw.extracted as Record<string, unknown>)
      : {};

  const suggestedAction =
    typeof raw.suggestedAction === 'string' && raw.suggestedAction.trim()
      ? raw.suggestedAction.trim()
      : 'REPLY_ONLY';

  const suggestedResponsibleRole =
    raw.suggestedResponsibleRole === 'office' || raw.suggestedResponsibleRole === 'field'
      ? raw.suggestedResponsibleRole
      : null;

  return {
    classification,
    confidence,
    summary,
    extracted: {
      ...extracted,
      suggestedResponsibleRole,
    },
    suggestedAction,
    suggestedResponsibleRole,
  };
}
