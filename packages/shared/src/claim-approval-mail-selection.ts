export type ApprovalInformCc = {
  email: string;
  name: string;
};

function foldEmail(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

/** Ortak kutu — personel adresi değil. */
function isSharedOperationalMailbox(email?: string | null): boolean {
  const folded = foldEmail(email);
  if (!folded.includes('@')) return false;
  if (folded === 'ihbar@safranbh.com' || folded === 'hasar@safranbh.com') return true;
  const [local, host] = folded.split('@');
  if (local !== 'ihbar' && local !== 'hasar') return false;
  return host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com');
}

/** Onaya Gönder: personel işaretlediği adresler; yalnız izinli listeden geçer. */
export function filterSelectedApprovalEmails(
  allowedEmails: string[],
  selectedEmails?: string[] | null,
): string[] {
  const allowed = new Map<string, string>();
  for (const raw of allowedEmails) {
    const email = String(raw ?? '').trim();
    const key = foldEmail(email);
    if (!key.includes('@') || allowed.has(key)) continue;
    allowed.set(key, email);
  }
  if (!selectedEmails || selectedEmails.length === 0) {
    return [...allowed.values()];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selectedEmails) {
    const key = foldEmail(raw);
    if (!key.includes('@') || seen.has(key)) continue;
    const allowedEmail = allowed.get(key);
    if (!allowedEmail) continue;
    seen.add(key);
    out.push(allowedEmail);
  }
  return out;
}

/** Gönderen Meridyen personeli — sabit bilgilendirme CC; ortak kutu ve kod gömülü adres yok. */
export function resolveApprovalInformCc(sender?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null): ApprovalInformCc | null {
  const email = String(sender?.email ?? '').trim();
  if (!email.includes('@')) return null;
  if (isSharedOperationalMailbox(email)) return null;
  const name = String(sender?.name ?? '').trim()
    || `${String(sender?.firstName ?? '').trim()} ${String(sender?.lastName ?? '').trim()}`.trim();
  return { email, name: name || email };
}

export function mergeApprovalMailCc(input: {
  informCc: ApprovalInformCc | null;
  extraCc?: Array<{ email: string; name?: string }>;
  toEmails: string[];
}): Array<{ email: string; name?: string }> {
  const blocked = new Set(
    input.toEmails.map((email) => foldEmail(email)).filter((e) => e.includes('@')),
  );
  const out: Array<{ email: string; name?: string }> = [];
  const seen = new Set<string>();
  const push = (row: { email: string; name?: string } | null | undefined) => {
    if (!row) return;
    const email = String(row.email ?? '').trim();
    const key = foldEmail(email);
    if (!key.includes('@') || seen.has(key) || blocked.has(key)) return;
    if (isSharedOperationalMailbox(key)) return;
    seen.add(key);
    out.push({ email, name: String(row.name ?? '').trim() || undefined });
  };
  push(input.informCc ?? undefined);
  for (const row of input.extraCc ?? []) push(row);
  return out;
}
