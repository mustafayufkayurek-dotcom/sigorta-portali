/**
 * 72s onay hatırlatması — otomatik müşteri maili yok.
 * Dosya sorumlusu onaylar; alıcı tercihe bağlı broker / eksper / sigorta (müşteri kartı varsayılan değil).
 */
import { HASAR_TESPIT_MUHATAP_SIRASI } from './hasar-tespit-muhatap';
import { hizmetKartiCodeForClaim } from './hizmet-karti';
import { resolveClaimMailRoute, type ClaimMailParty } from './claim-mail-route';
import { APPROVAL_72H_MS } from './operation-status';

export const APPROVAL_72H_OWNER_PROMPT_TYPE = 'approval_72h_exceeded';
export const APPROVAL_72H_REMINDER_SENT_TYPE = 'approval_72h_reminder_sent';

export const APPROVAL_72H_OWNER_PROMPT_TITLE = 'Onay Süresi Geçti';
export const APPROVAL_72H_OWNER_PROMPT_BODY =
  'Dosyanın onay süresi geçmiştir. Onay muhatabı ile lütfen iletişime geçin veya hatırlatma maili gönderilsin mi?';

/** Bilgilendirme gövdesi (hitapsız). */
export const APPROVAL_72H_OWNER_RELATION_BODY =
  'yalnız mail ile yapılan onay talepleri dosyanın red riskini yükseltir. Bu nedenle müşteri ile iletişiminizi güçlendirmeye gayret ediniz.';

/** @deprecated Yerine buildApproval72hOwnerRelationNote kullanın. */
export const APPROVAL_72H_OWNER_RELATION_NOTE = `Sn. meslektaşımız, ${APPROVAL_72H_OWNER_RELATION_BODY}`;

/** Dosya sorumlusu bilgilendirmesi — Sn. + soyad otomatik. */
export function buildApproval72hOwnerRelationNote(input?: {
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const direct = String(input?.lastName ?? '').trim();
  const nameParts = String(input?.fullName ?? '').trim().split(/\s+/).filter(Boolean);
  // Tek kelimelik fullName soyad sayılmaz (yanlış hitap riski).
  const fromFull = nameParts.length >= 2 ? (nameParts[nameParts.length - 1] ?? '') : '';
  const surname = direct || fromFull;
  const hitap = surname ? `Sn. ${surname}` : 'Sn. meslektaşımız';
  return `${hitap}, ${APPROVAL_72H_OWNER_RELATION_BODY}`;
}

export const APPROVAL_72H_FROM_DISPLAY_NAME = 'Meridyen';

export const CLAIM_MAIL_PARTY_LABEL_TR: Record<ClaimMailParty, string> = {
  insurance: 'Sigorta Şirketi',
  agency: 'Acente',
  broker: 'Broker',
  expert: 'Eksper',
};

export type Approval72hReminderPartySource = {
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  shortName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  contacts?: Array<{
    id?: string | null;
    name?: string | null;
    email?: string | null;
    isPrimary?: boolean | null;
  }> | null;
  contactInfos?: Array<{ type?: string | null; label?: string | null; value?: string | null }> | null;
} | null | undefined;

export type Approval72hReminderRecipient = {
  id: string;
  email: string;
  name: string;
  role: string;
  party: ClaimMailParty;
  preferred: boolean;
};

function foldEmail(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function partyDisplayName(row: Approval72hReminderPartySource, fallback: string): string {
  if (!row) return fallback;
  const contacts = Array.isArray(row.contacts) ? row.contacts : [];
  const primary = contacts.find((c) => c?.isPrimary) ?? contacts[0];
  const contactPerson = String(primary?.name ?? '').trim();
  if (contactPerson) return contactPerson;
  const short = String(row.shortName ?? '').trim();
  if (short) return short;
  const company = String(row.companyName ?? row.name ?? '').trim();
  if (company) return company;
  const full = String(row.fullName ?? '').trim();
  if (full) return full;
  const person = `${String(row.firstName ?? '').trim()} ${String(row.lastName ?? '').trim()}`.trim();
  return person || fallback;
}

function pushRecipient(
  out: Approval72hReminderRecipient[],
  seen: Set<string>,
  input: {
    id: string;
    email?: string | null;
    name: string;
    role: string;
    party: ClaimMailParty;
    preferred: boolean;
  },
) {
  const email = String(input.email ?? '').trim();
  const key = foldEmail(email);
  if (!key || !isValidEmail(key) || seen.has(key)) return;
  seen.add(key);
  out.push({
    id: input.id,
    email,
    name: input.name.trim() || email,
    role: input.role,
    party: input.party,
    preferred: input.preferred,
  });
}

/** Onay hatırlatması alıcıları — müşteri kartı (ör. Doğanlar Holding) varsayılan değildir. */
export function buildApproval72hReminderRecipients(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  serviceMailRoute?: unknown;
  insuranceCompany?: { id?: string | null; name?: string | null; contactEmail?: string | null } | null;
  channelAgencyCustomer?: Approval72hReminderPartySource;
  channelBrokerCustomer?: Approval72hReminderPartySource;
  channelExpertCustomer?: Approval72hReminderPartySource;
  expertOffice?: Approval72hReminderPartySource;
}): Approval72hReminderRecipient[] {
  const route = resolveClaimMailRoute({
    serviceKind: input.serviceKind,
    consultancyServiceType: input.consultancyServiceType,
    mailRouteJson: input.mailRouteJson,
    serviceMailRoute: input.serviceMailRoute,
  });
  const hizmet = hizmetKartiCodeForClaim({
    serviceKind: input.serviceKind,
    consultancyServiceType: input.consultancyServiceType,
  });
  const parties: ClaimMailParty[] = route?.approval?.length
    ? [...route.approval]
    : hizmet === 'hasar-tespit'
      ? [...HASAR_TESPIT_MUHATAP_SIRASI]
      : (['insurance', 'expert'] as ClaimMailParty[]);

  const expertParty = input.channelExpertCustomer ?? input.expertOffice ?? null;
  if (expertParty && !parties.includes('expert')) {
    parties.push('expert');
  }

  const byParty: Record<ClaimMailParty, Approval72hReminderPartySource | { email?: string | null; name?: string | null; companyName?: string | null }> = {
    insurance: {
      email: input.insuranceCompany?.contactEmail,
      name: input.insuranceCompany?.name,
      companyName: input.insuranceCompany?.name,
    },
    agency: input.channelAgencyCustomer,
    broker: input.channelBrokerCustomer,
    expert: expertParty,
  };

  const out: Approval72hReminderRecipient[] = [];
  const seen = new Set<string>();

  for (const party of parties) {
    const role = CLAIM_MAIL_PARTY_LABEL_TR[party];
    const row = byParty[party];
    if (!row) continue;
    const orgName = partyDisplayName(row as Approval72hReminderPartySource, role);

    const contacts = Array.isArray((row as Approval72hReminderPartySource)?.contacts)
      ? (row as Approval72hReminderPartySource)!.contacts!
      : [];
    for (const [index, contact] of contacts.entries()) {
      const personName = String(contact?.name ?? '').trim() || orgName;
      pushRecipient(out, seen, {
        id: `${party}:contact:${contact?.id ?? index}`,
        email: contact?.email,
        name: personName,
        role,
        party,
        preferred: false,
      });
    }
    for (const [index, info] of ((row as Approval72hReminderPartySource)?.contactInfos ?? []).entries()) {
      const kind = String(info?.type ?? '').trim();
      const label = String(info?.label ?? 'general').trim().toLowerCase();
      if (kind !== 'email' || label !== 'general') continue;
      pushRecipient(out, seen, {
        id: `${party}:info:${index}`,
        email: info?.value,
        name: orgName,
        role,
        party,
        preferred: false,
      });
    }
    pushRecipient(out, seen, {
      id: `${party}:org`,
      email: row.email,
      name: orgName,
      role,
      party,
      preferred: false,
    });
  }

  // Hasar Tespit’te tercih broker veya eksper; ana müşteri kartı (Doğanlar) zaten listede yok.
  if (hizmet === 'hasar-tespit') {
    const prefer = out.find((r) => r.party === 'broker' || r.party === 'expert');
    if (prefer) prefer.preferred = true;
    else if (out[0]) out[0].preferred = true;
  } else if (out[0]) {
    out[0].preferred = true;
  }
  return out;
}

/** Seçilen adresler izinli listede olmalı; boş seçim reddedilir. */
export function filterConfirmedApproval72hEmails(
  selected: string[],
  allowed: Array<{ email: string }>,
): string[] {
  const allow = new Set(allowed.map((r) => foldEmail(r.email)).filter((e) => e.includes('@')));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selected) {
    const key = foldEmail(raw);
    if (!key || !allow.has(key) || seen.has(key)) continue;
    seen.add(key);
    const match = allowed.find((r) => foldEmail(r.email) === key);
    if (match) out.push(match.email.trim());
  }
  return out;
}

/** Son bildirimden beri 72 saat dolmadıysa yeniden uyarı yok. */
export function shouldPromptApproval72hAgain(
  lastPromptAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!lastPromptAt) return true;
  const at = new Date(lastPromptAt).getTime();
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at >= APPROVAL_72H_MS;
}

export function buildApproval72hOwnerNotification(fileNo: string): { title: string; body: string } {
  const no = String(fileNo ?? '').trim() || 'Dosya';
  return {
    title: APPROVAL_72H_OWNER_PROMPT_TITLE,
    body: `${no} — ${APPROVAL_72H_OWNER_PROMPT_BODY}`,
  };
}

/** Açılan pencerede dosya kimliği ilk satırda durur. */
export function buildApproval72hOwnerDialogMessage(input: {
  fileNo?: string | null;
  insuredName?: string | null;
}): string {
  const no = String(input.fileNo ?? '').trim() || '—';
  const insured = String(input.insuredName ?? '').trim();
  const lines = [`Dosya No: ${no}`];
  if (insured) lines.push(`Sigortalı: ${insured}`);
  lines.push('', APPROVAL_72H_OWNER_PROMPT_BODY);
  return lines.join('\n');
}
