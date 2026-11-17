export type ApprovalInformCc = {
  email: string;
  name: string;
};

/** Onaya Gönder konusu: Hasar Tespit Raporu/Doğanlar Mobilya Grubu/Dosya No */
export function buildClaimApprovalMailSubject(
  documentTitle: string,
  customerName: string | null | undefined,
  fileNo: string | null | undefined,
): string {
  const title = String(documentTitle ?? '').trim() || 'Hasar Onarım Raporu';
  const customer = String(customerName ?? '').trim() || '—';
  const no = String(fileNo ?? '').trim() || '—';
  return `${title}/${customer}/${no}`;
}

export function claimApprovalCustomerDisplayName(customer?: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  name?: string | null;
} | null): string {
  return (
    String(customer?.shortName ?? '').trim()
    || String(customer?.companyName ?? '').trim()
    || String(customer?.fullName ?? '').trim()
    || String(customer?.name ?? '').trim()
  );
}

/**
 * Kişi adından soyad. Firma / ülke / unvan (Howden Türkiye, Doğanlar Mobilya Grb.) boş kalır.
 * Örn. Ali Çakar → Çakar; Aslı Güngör → Güngör.
 */
export function approvalRecipientSurname(name?: string | null): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  if (
    /(sigorta|broker|eksper|ltd\.?|a\.?\s?ş\.?|assistance|asistans|şirket|firma|demo|pilot|türkiye|turkey|holding|grubu|\bgrb\.?\b|group|mobilya|howden|meridyen|san\.?|tic\.?|\bas\b|anonim|limited|şubesi|ofisi|müşteri)/i.test(
      raw,
    )
  ) {
    return '';
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  const last = parts[parts.length - 1] ?? '';
  if (/^(türkiye|turkey|grubu|grb\.?|group|holding|ltd\.?|a\.?ş\.?)$/i.test(last)) return '';
  return last;
}

/** Hasar Tespit hitabı: Sn. Çakar, — kişi yoksa Sn. Yetkili, */
export function claimApprovalGreeting(nameOrSurname?: string | null): string {
  const raw = String(nameOrSurname ?? '').trim();
  if (!raw) return 'Sn. Yetkili,';
  const soyad =
    approvalRecipientSurname(raw)
    || (!/\s/.test(raw) && approvalRecipientSurname(`Kişi ${raw}`) === raw ? raw : '');
  return soyad ? `Sn. ${soyad},` : 'Sn. Yetkili,';
}

/** Yazım kutusundan hitap + gövde ayırır. */
export function splitClaimApprovalMessageText(text: string | null | undefined): {
  greeting: string;
  body: string;
} {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return { greeting: '', body: '' };
  const lines = normalized.split('\n');
  const first = (lines[0] ?? '').trim();
  if (/^(Sayın\b|Sn\.)/i.test(first)) {
    return {
      greeting: first,
      body: lines.slice(1).join('\n').replace(/^\n+/, '').trim(),
    };
  }
  return { greeting: '', body: normalized };
}

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

/** Onaya Gönder: personel işaretlediği adresler; varsayılan yalnız izinli listeden. */
export function filterSelectedApprovalEmails(
  allowedEmails: string[],
  selectedEmails?: string[] | null,
  options?: { allowManualExtra?: boolean },
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
    const email = String(raw ?? '').trim();
    const key = foldEmail(email);
    if (!key.includes('@') || seen.has(key)) continue;
    const allowedEmail = allowed.get(key);
    if (allowedEmail) {
      seen.add(key);
      out.push(allowedEmail);
      continue;
    }
    if (options?.allowManualExtra && !/[\s,;<>]/.test(email)) {
      seen.add(key);
      out.push(email);
    }
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

/** Dosya sorumlusu — Onaya Gönder’de otomatik Bilgi (Cc); ortak kutu yok. */
export function resolveApprovalFileOwnerCc(owner?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null): ApprovalInformCc | null {
  return resolveApprovalInformCc(owner);
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
