/** Panelden giden mail: gönderildi / okunmadı / okundu. Sahte okundu yok. */

export type OutboundMailSignal = 'idle' | 'sending' | 'sent' | 'read' | 'replied' | 'failed';

export type MailReceiptKind = 'read' | 'not_read' | 'failed';

export function outboundMailSignal(input: {
  sending?: boolean;
  failed?: boolean;
  lastReplyAt?: string | null;
  lastReplyReadAt?: string | null;
  lastReplyFailedAt?: string | null;
  lastCounterpartReplyAt?: string | null;
}): OutboundMailSignal {
  if (input.sending) return 'sending';
  if (input.failed || input.lastReplyFailedAt) return 'failed';
  if (input.lastCounterpartReplyAt) return 'replied';
  if (input.lastReplyReadAt) return 'read';
  if (input.lastReplyAt) return 'sent';
  return 'idle';
}

const READ_SUBJECT = /^(okundu|read|lu|gelesen)\s*:/i;
const NOT_READ_SUBJECT = /^(okunmad[ıi]|not\s*read|non\s*lu)\s*:/i;
const FAILED_SUBJECT =
  /^(iletilemedi|undeliverable|undelivered|delivery\s*status\s*notification|mail\s*delivery\s*failed|returned\s*mail)\b/i;

export const MAIL_RECEIPT_READ_TITLE = 'Okundu';
export const MAIL_RECEIPT_READ_LEAD = 'Karşı taraf bu yazıyı okudu.';
export const MAIL_RECEIPT_READ_EXPLAIN =
  'İş bitmiş sayılmaz. Kesin teyit: karşı tarafın yanıtı.';
export const MAIL_RECEIPT_NOT_READ_TITLE = 'Okunmadı';
export const MAIL_RECEIPT_NOT_READ_LEAD = 'Karşı taraf bu yazıyı henüz okumadı.';
export const MAIL_RECEIPT_FAILED_TITLE = 'Ulaşmadı';
export const MAIL_RECEIPT_FAILED_LEAD = 'Yazı karşı tarafa ulaşmadı.';

export function classifyMailReceipt(input: {
  subject?: string | null;
  fromAddress?: string | null;
  bodyPreview?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): MailReceiptKind | null {
  const subject = String(input.subject ?? '').trim();
  if (READ_SUBJECT.test(subject)) return 'read';
  if (NOT_READ_SUBJECT.test(subject)) return 'not_read';
  if (FAILED_SUBJECT.test(subject)) return 'failed';
  const blob = [input.bodyPreview, input.bodyText, input.bodyHtml].filter(Boolean).join('\n');
  if (/was read on/i.test(blob) || /this is a read receipt/i.test(blob)) return 'read';
  if (/deleted without being read|not read on/i.test(blob)) return 'not_read';
  const from = String(input.fromAddress ?? '').toLowerCase();
  if (from.includes('mailer-daemon') || from.includes('postmaster')) return 'failed';
  return null;
}

export function receiptOriginalSubject(subject: string): string {
  return subject
    .replace(/^(okundu|read|lu|gelesen|okunmad[ıi]|not\s*read|non\s*lu)\s*:\s*/i, '')
    .replace(/^(iletilemedi|undeliverable|ulaşmadı)\s*:\s*/i, '')
    .trim();
}

export function isReadableMailReceiptHtml(html?: string | null): boolean {
  const text = String(html ?? '');
  return (
    text.includes(MAIL_RECEIPT_READ_LEAD) ||
    text.includes(MAIL_RECEIPT_NOT_READ_LEAD) ||
    text.includes(MAIL_RECEIPT_FAILED_LEAD)
  );
}

export function buildMailReceiptDisplay(input: {
  kind: MailReceiptKind;
  originalSubject: string;
  seenAt?: Date | string | null;
}): { subject: string; plain: string; html: string; preview: string } {
  const original = receiptOriginalSubject(input.originalSubject) || input.originalSubject;
  const title =
    input.kind === 'read'
      ? MAIL_RECEIPT_READ_TITLE
      : input.kind === 'not_read'
        ? MAIL_RECEIPT_NOT_READ_TITLE
        : MAIL_RECEIPT_FAILED_TITLE;
  const lead =
    input.kind === 'read'
      ? MAIL_RECEIPT_READ_LEAD
      : input.kind === 'not_read'
        ? MAIL_RECEIPT_NOT_READ_LEAD
        : MAIL_RECEIPT_FAILED_LEAD;
  const explain = input.kind === 'read' ? MAIL_RECEIPT_READ_EXPLAIN : '';
  const when = formatReceiptSeenAt(input.seenAt);
  const whenLine = when ? `Tarih: ${when}` : '';
  const subject = `${title}: ${original}`.trim();
  const plain = [lead, original ? `Konu: ${original}` : '', whenLine, explain]
    .filter(Boolean)
    .join('\n');
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:collapse;max-width:640px">
<tr><td style="background:#1e3a5f;color:#ffffff;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.3">${escapeReceiptHtml(title)}</td></tr>
<tr><td style="border:1px solid #cbd5e1;border-top:0;background:#f8fafc;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
<p style="margin:0 0 10px">${escapeReceiptHtml(lead)}</p>
${original ? `<p style="margin:0 0 6px">Konu: ${escapeReceiptHtml(original)}</p>` : ''}
${whenLine ? `<p style="margin:0 0 10px">${escapeReceiptHtml(whenLine)}</p>` : ''}
${explain ? `<p style="margin:0;color:#334155">${escapeReceiptHtml(explain)}</p>` : ''}
</td></tr>
</table>`;
  return { subject, plain, html, preview: lead };
}

function formatReceiptSeenAt(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeReceiptHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
