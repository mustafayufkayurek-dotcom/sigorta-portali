/** Kartta kişi e-postası ile genel kutu ayrı durur. Giriş hesabı genel kutu değildir. */

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function splitCustomerMailboxes(raw?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? '').split(/[;,\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !MAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function personMailboxFromList(raw?: string | null): string {
  return splitCustomerMailboxes(raw)[0] ?? '';
}

export function extraMailboxesFromList(raw?: string | null): string[] {
  return splitCustomerMailboxes(raw).slice(1);
}

type Channel = { type?: string | null; label?: string | null; value?: string | null };

function isGeneralEmailChannel(row: Channel): boolean {
  return String(row.type ?? '').trim() === 'email'
    && String(row.label ?? 'general').trim().toLowerCase() === 'general';
}

export function generalMailboxFromContactInfos(infos: Channel[] | null | undefined): string {
  const row = (infos ?? []).find((item) => isGeneralEmailChannel(item) && String(item.value ?? '').trim());
  return personMailboxFromList(row?.value);
}

export function generalMailboxesFromContactInfos(infos: Channel[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of infos ?? []) {
    if (!isGeneralEmailChannel(row)) continue;
    for (const email of splitCustomerMailboxes(row.value)) {
      if (seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

export function upsertGeneralMailboxContactInfos<T extends { type: string; value: string; label: string }>(
  infos: T[],
  mailbox: string,
): T[] {
  const email = personMailboxFromList(mailbox);
  const others = infos.filter((row) => !isGeneralEmailChannel(row));
  if (!email) return others;
  return [...others, { type: 'email', value: email, label: 'general' } as T];
}

export function appendGeneralMailboxes<T extends { type: string; value: string; label: string }>(
  infos: T[],
  extras: string[],
): T[] {
  let next = [...infos];
  const have = new Set(generalMailboxesFromContactInfos(next));
  for (const box of extras) {
    const email = personMailboxFromList(box);
    if (!email || have.has(email)) continue;
    have.add(email);
    const emptyIdx = next.findIndex((row) => isGeneralEmailChannel(row) && !String(row.value ?? '').trim());
    if (emptyIdx >= 0) {
      next = next.map((row, index) => (index === emptyIdx ? { ...row, type: 'email', label: 'general', value: email } : row));
    } else {
      next = [...next, { type: 'email', value: email, label: 'general' } as T];
    }
  }
  return next;
}
