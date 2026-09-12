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

export function classifyMailReceipt(input: {
  subject?: string | null;
  fromAddress?: string | null;
}): MailReceiptKind | null {
  const subject = String(input.subject ?? '').trim();
  if (!subject) return null;
  if (READ_SUBJECT.test(subject)) return 'read';
  if (NOT_READ_SUBJECT.test(subject)) return 'not_read';
  if (FAILED_SUBJECT.test(subject)) return 'failed';
  const from = String(input.fromAddress ?? '').toLowerCase();
  if (from.includes('mailer-daemon') || from.includes('postmaster')) return 'failed';
  return null;
}

export function receiptOriginalSubject(subject: string): string {
  return subject
    .replace(/^(okundu|read|lu|gelesen|okunmad[ıi]|not\s*read|non\s*lu)\s*:\s*/i, '')
    .replace(/^(iletilemedi|undeliverable)\s*:\s*/i, '')
    .trim();
}
