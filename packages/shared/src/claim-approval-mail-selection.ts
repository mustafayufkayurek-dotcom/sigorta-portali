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

/** Sık geçen kadın adları — Bey/Hanım seçimi (tam liste değildir). */
const TR_FEMALE_FIRST_NAMES = new Set(
  [
    'ayşe', 'ayse', 'fatma', 'emine', 'hatice', 'zeynep', 'elif', 'merve',
    'aslı', 'asli', 'selin', 'deniz', 'esra', 'büşra', 'busra', 'gül', 'gul',
    'özge', 'ozge', 'pınar', 'pinar', 'seda', 'sevil', 'serap', 'şeyma', 'seyma',
    'tuğba', 'tugba', 'yasemin', 'yeliz', 'yıldız', 'yildiz', 'zehra', 'nur', 'dilek',
    'hande', 'hülya', 'hulya', 'irem', 'i̇rem', 'melis', 'meltem', 'nil', 'nilüfer',
    'nilufer', 'özlem', 'ozlem', 'sibel', 'songül', 'songul', 'tülin', 'tulin',
    'gonca', 'damla', 'ceren', 'burcu', 'bahar', 'banu', 'berna', 'betül', 'betul',
    'canan', 'çiğdem', 'cigdem', 'derya', 'duygu', 'ece', 'eda', 'ebru', 'filiz',
    'fulya', 'gamze', 'gizem', 'gönül', 'gonul', 'hale', 'hilal', 'ilknur', 'inci',
    'jale', 'kübra', 'kubra', 'leyla', 'lale', 'mine', 'naciye', 'nazlı', 'nazli',
    'neslihan', 'nevin', 'nihan', 'nuran', 'nuray', 'nurcan', 'pelin', 'pervin',
    'rukiye', 'safiye', 'sati', 'şükran', 'sukran', 'sevgi', 'sevim', 'süheyla',
    'suheyla', 'şule', 'sule', 'tuba', 'ülkü', 'ulku', 'ümmü', 'ummu', 'vesile',
  ].map((n) => n.normalize('NFC').toLocaleLowerCase('tr-TR')),
);

/** Kişi adından ilk ad (firma satırında boş). */
export function approvalRecipientFirstName(name?: string | null): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  if (approvalRecipientSurname(raw) === '' && /\s/.test(raw)) return '';
  // Tek kelime: soyad sanılan eski kullanımda da ilk ad gibi kullanılır (Görkem).
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    // Firma tek kelime değilse (Demo vb.) — soyad kuralı yoksa kişi kabul
    if (/(sigorta|broker|eksper|ltd|şirket|firma|grubu|grb|holding|group|mobilya|howden|meridyen)/i.test(parts[0]!)) {
      return '';
    }
    return parts[0]!;
  }
  // En az iki kelime ve soyad çıkıyorsa kişi — ilk kelime ad
  if (approvalRecipientSurname(raw)) return parts[0]!;
  return '';
}

export function approvalRecipientHonorific(firstName?: string | null): 'Bey' | 'Hanım' {
  const key = String(firstName ?? '').trim().normalize('NFC').toLocaleLowerCase('tr-TR');
  if (key && TR_FEMALE_FIRST_NAMES.has(key)) return 'Hanım';
  return 'Bey';
}

/**
 * Hasar Tespit hitabı (Raporu Gönder): «Görkem Bey Merhaba,»
 * Kişi yoksa: «Merhaba,»
 */
export function claimApprovalGreeting(nameOrSurname?: string | null): string {
  const first = approvalRecipientFirstName(nameOrSurname);
  if (!first) return 'Merhaba,';
  return `${first} ${approvalRecipientHonorific(first)} Merhaba,`;
}

/** Hasar Tespit gövde — ekran onayı. */
export const CLAIM_APPROVAL_TESPIT_BODY =
  'Dosyaya Ait Hasar Tespit Raporunu Ekte Bilgilerinize Sunar;\nOlumlu İş Birliğimizin Devamını Dileriz.';

/** Yazım kutusundan hitap + gövde ayırır. */
export function splitClaimApprovalMessageText(text: string | null | undefined): {
  greeting: string;
  body: string;
} {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return { greeting: '', body: '' };
  const lines = normalized.split('\n');
  const first = (lines[0] ?? '').trim();
  if (
    /^(Sayın\b|Sn\.)/i.test(first)
    || /\bMerhaba,?$/i.test(first)
  ) {
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
