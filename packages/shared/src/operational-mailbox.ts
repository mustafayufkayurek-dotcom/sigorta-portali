/** Ortak okuma kutuları. Tüm safranbh.com iç kutu değildir. */

export const OPERATIONAL_SHARED_MAILBOXES = ['ihbar@safranbh.com', 'hasar@safranbh.com'] as const;

export function foldMailboxAddress(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

export function isOperationalSharedMailbox(email?: string | null): boolean {
  const folded = foldMailboxAddress(email);
  if (!folded.includes('@')) return false;
  if ((OPERATIONAL_SHARED_MAILBOXES as readonly string[]).includes(folded)) return true;
  const [local, host] = folded.split('@');
  if (local !== 'ihbar' && local !== 'hasar') return false;
  return host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com');
}

/** Dosya maili alıcısı: Meridyen alanı ve ortak kutu. Personel hoş geldini kesmez. */
export function isMeridyenInternalMailbox(email?: string | null): boolean {
  const folded = foldMailboxAddress(email);
  const host = folded.split('@')[1] || '';
  if (!host || host === 'localhost' || host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com')) {
    return true;
  }
  return isOperationalSharedMailbox(folded);
}

export function isReplyOrForwardMailSubject(subject?: string | null): boolean {
  return /^(re|fw|fwd|ynt|yanıt|yanit|iletilemedi|undeliverable|undelivered)\s*:/i.test(
    String(subject ?? '').trim(),
  );
}

export function isSoftwareOutboundSubject(subject?: string | null): boolean {
  const value = String(subject ?? '').trim();
  if (!value) return false;
  const folded = value.toLocaleLowerCase('tr-TR');
  if (folded.startsWith('dosya kapanışı') || folded.startsWith('dosya kapanisi')) return true;
  if (folded.startsWith('platform mail kopyası') || folded.startsWith('platform mail kopyasi')) return true;
  if (folded.startsWith('rapor onaylandı') || folded.startsWith('rapor onaylandi')) return true;
  if (/onay talep\s*$/i.test(value)) return true;
  return false;
}

/** Kuyruk yankısı: ortak kutunun kendi yazılım yazısı. Yanıt ve dış gönderen durur. */
export function isSoftwareOutboundInboxEcho(input: {
  fromAddress?: string | null;
  subject?: string | null;
  mailboxAddress?: string | null;
  siblingMailboxAddress?: string | null;
}): boolean {
  if (isReplyOrForwardMailSubject(input.subject)) return false;
  if (!isSoftwareOutboundSubject(input.subject)) return false;
  const from = foldMailboxAddress(input.fromAddress);
  if (!from.includes('@')) return false;
  if (isOperationalSharedMailbox(from)) return true;
  const boxes = [input.mailboxAddress, input.siblingMailboxAddress].map(foldMailboxAddress).filter(Boolean);
  return boxes.includes(from);
}

export function filterSoftwareMailboxRecipients(
  addresses: Array<string | null | undefined>,
  mailboxAddress?: string | null,
): string[] {
  const box = foldMailboxAddress(mailboxAddress);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const addr = String(raw ?? '').trim();
    const key = foldMailboxAddress(addr);
    if (!key.includes('@') || seen.has(key)) continue;
    if (isOperationalSharedMailbox(key)) continue;
    if (box && key === box) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}
