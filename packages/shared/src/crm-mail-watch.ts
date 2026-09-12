/** CRM tanıtım maili: gönderildi / ulaşmadı / yanıt geldi. Sahte okundu yok. */
export type CrmMailWatch = 'sent' | 'bounced' | 'replied';

export const CRM_COPY_BLOCKED_MAILBOXES = ['ihbar@safranbh.com', 'hasar@safranbh.com'] as const;

export function canSendVisibleCopy(email: string | null | undefined, exclude: Array<string | null | undefined> = []): boolean {
  const folded = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!folded.includes('@') || folded.endsWith('@example.com')) return false;
  if ((CRM_COPY_BLOCKED_MAILBOXES as readonly string[]).includes(folded)) return false;
  const blocked = new Set(
    exclude
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  return !blocked.has(folded);
}

export function crmMailWatch(value?: {
  repliedAt?: string | null;
  bouncedAt?: string | null;
  deliveryStatus?: string | null;
} | null): CrmMailWatch {
  if (value?.repliedAt || value?.deliveryStatus === 'replied') return 'replied';
  if (value?.bouncedAt || value?.deliveryStatus === 'bounced') return 'bounced';
  return 'sent';
}

export function foldMailSubject(subject: string): string {
  let text = String(subject ?? '').trim();
  for (let i = 0; i < 6; i += 1) {
    const next = text
      .replace(/^(re|fw|fwd|ynt|yanıt|yanit)\s*:\s*/i, '')
      .replace(/^(iletilemedi|undeliverable|undelivered)\s*:\s*/i, '')
      .trim();
    if (next === text) break;
    text = next;
  }
  return text.toLowerCase();
}

export function matchCrmEmailWatchLog(
  logs: Array<{
    id: string;
    payload: {
      to?: string | null;
      subject?: string | null;
      sentAt?: string | null;
      repliedAt?: string | null;
      bouncedAt?: string | null;
    };
  }>,
  input: {
    kind: 'failed' | 'replied';
    fromAddress?: string | null;
    subject?: string | null;
    receivedAt: Date | string;
  },
): string | null {
  const receivedAt = new Date(input.receivedAt).getTime();
  if (Number.isNaN(receivedAt)) return null;

  if (input.kind === 'failed') {
    const original = foldMailSubject(String(input.subject ?? ''));
    if (!original) return null;
    const hit = logs.find((log) => {
      if (log.payload.repliedAt) return false;
      if (log.payload.bouncedAt) return false;
      const sentAt = log.payload.sentAt ? new Date(log.payload.sentAt).getTime() : 0;
      if (sentAt && sentAt > receivedAt) return false;
      return foldMailSubject(String(log.payload.subject ?? '')) === original;
    });
    return hit?.id ?? null;
  }

  const from = String(input.fromAddress ?? '')
    .trim()
    .toLowerCase();
  if (!from.includes('@')) return null;
  if ((CRM_COPY_BLOCKED_MAILBOXES as readonly string[]).includes(from)) return null;
  const replySubject = foldMailSubject(String(input.subject ?? ''));
  const candidates = logs.filter((log) => {
    if (log.payload.repliedAt) return false;
    const to = String(log.payload.to ?? '')
      .trim()
      .toLowerCase();
    if (to !== from) return false;
    const sentAt = log.payload.sentAt ? new Date(log.payload.sentAt).getTime() : 0;
    if (sentAt && sentAt > receivedAt) return false;
    return true;
  });
  const subjectHit = candidates.find((log) => foldMailSubject(String(log.payload.subject ?? '')) === replySubject);
  return (subjectHit ?? candidates[0])?.id ?? null;
}
