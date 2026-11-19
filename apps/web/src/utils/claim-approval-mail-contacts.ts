import {
  CLAIM_MAIL_PARTY_LABEL,
  HASAR_TESPIT_MUHATAP_SIRASI,
  approvalRecipientSurname,
  buildClaimApprovalMailSubject,
  CLAIM_APPROVAL_TESPIT_BODY,
  claimApprovalGreeting,
  hasarReportDocumentTitle,
  hizmetKartiCodeForClaim,
  resolveClaimMailRoute,
  type ClaimMailParty,
  type ClaimMailRoute,
} from '@sigorta/shared';

export type MailContact = {
  id: string;
  name: string;
  role: string;
  email: string;
};

type ChannelParty = {
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

function foldEmail(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

function partyDisplayName(row: ChannelParty, fallback: string): string {
  const contacts = Array.isArray(row?.contacts) ? row!.contacts! : [];
  const primary = contacts.find((c) => c?.isPrimary) ?? contacts[0];
  const contactPerson = String(primary?.name ?? '').trim();
  if (contactPerson) return contactPerson;
  const short = String(row?.shortName ?? '').trim();
  if (short) return short;
  const company = String(row?.companyName ?? row?.name ?? '').trim();
  if (company) return company;
  const full = String(row?.fullName ?? '').trim();
  if (full) return full;
  const person = `${String(row?.firstName ?? '').trim()} ${String(row?.lastName ?? '').trim()}`.trim();
  return person || fallback;
}

function pushContact(
  out: MailContact[],
  seen: Set<string>,
  input: { id: string; name: string; role: string; email?: string | null },
) {
  const email = String(input.email ?? '').trim();
  const key = foldEmail(email);
  if (!key.includes('@') || seen.has(key)) return;
  seen.add(key);
  out.push({
    id: input.id,
    name: input.name.trim() || email,
    role: input.role,
    email,
  });
}

/** Dosya muhatapları — kişi + tam e-posta; yinelenen adres bir kez. */
export function claimApprovalMailContacts(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  serviceMailRoute?: unknown;
  insuranceCompany?: { id?: string | null; name?: string | null; contactEmail?: string | null } | null;
  channelAgencyCustomer?: ChannelParty;
  channelBrokerCustomer?: ChannelParty;
  channelExpertCustomer?: ChannelParty;
  /** Rapor / dosya eksper ofisi — kanal boşken tercihte durur. */
  expertOffice?: ChannelParty;
}): MailContact[] {
  const route: ClaimMailRoute | null = resolveClaimMailRoute({
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
  // Eksper maili tercihte durur — rota eksper yazmasa da seçilebilir.
  if (expertParty && !parties.includes('expert')) {
    parties.push('expert');
  }
  const byParty: Record<ClaimMailParty, ChannelParty | { email?: string | null; name?: string | null }> = {
    insurance: {
      email: input.insuranceCompany?.contactEmail,
      name: input.insuranceCompany?.name,
      companyName: input.insuranceCompany?.name,
    },
    agency: input.channelAgencyCustomer,
    broker: input.channelBrokerCustomer,
    expert: expertParty,
  };

  const out: MailContact[] = [];
  const seen = new Set<string>();
  for (const party of parties) {
    const role = CLAIM_MAIL_PARTY_LABEL[party];
    const row = byParty[party];
    if (!row) continue;
    const orgName = partyDisplayName(row as ChannelParty, role);
    // Kişi adı kurumdan önce — aynı e-postada Sn. Türkiye yerine Sn. Çakar kalsın.
    const contacts = Array.isArray((row as ChannelParty)?.contacts) ? (row as ChannelParty)!.contacts! : [];
    for (const [index, contact] of contacts.entries()) {
      const personName = String(contact?.name ?? '').trim() || orgName;
      pushContact(out, seen, {
        id: `${party}:contact:${contact?.id ?? index}`,
        name: personName,
        role,
        email: contact?.email,
      });
    }
    for (const [index, info] of ((row as ChannelParty)?.contactInfos ?? []).entries()) {
      const kind = String(info?.type ?? '').trim();
      const label = String(info?.label ?? 'general').trim().toLowerCase();
      if (kind !== 'email' || label !== 'general') continue;
      pushContact(out, seen, {
        id: `${party}:info:${index}`,
        name: orgName,
        role,
        email: info?.value,
      });
    }
    pushContact(out, seen, {
      id: `${party}:org`,
      name: orgName,
      role,
      email: row.email,
    });
  }
  return out;
}

/** Mevcut ürün kuralı: taraf başına tercih edilen ilk adresler varsayılan Kime. */
export function claimApprovalDefaultToEmails(contacts: MailContact[], preferredEmails: string[]): string[] {
  const preferred = new Set(preferredEmails.map(foldEmail).filter((e) => e.includes('@')));
  if (preferred.size === 0) return [];
  return contacts
    .filter((row) => preferred.has(foldEmail(row.email)))
    .map((row) => row.email);
}

/** Kişi adından soyad; firma / ülke / tek kelime boş kalır. */
export function claimApprovalRecipientSurname(name?: string | null): string {
  return approvalRecipientSurname(name);
}

/**
 * Mesaj hitabı için ad: Kime’deki ilk **kişi** (soyadı çıkan).
 * Allianz Pilot / Howden Demo gibi firma satırını atlar; Sn. Çakar / Sn. Güngör üretir.
 */
export function claimApprovalFirstToGreetingName(
  recipients: Array<{ delivery?: string; name?: string | null }>,
): string {
  for (const row of recipients) {
    if (row.delivery !== 'to') continue;
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    if (approvalRecipientSurname(name)) return name;
  }
  // Firma-only Kime: kişi yoksa boş — Sn. Yetkili
  return '';
}

/** Dosya sorumlusu — Alıcılar listesinde Bilgi satırı. */
export function claimApprovalFileOwnerContact(owner?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null): MailContact | null {
  const email = String(owner?.email ?? '').trim();
  if (!email.includes('@')) return null;
  const name = `${String(owner?.firstName ?? '').trim()} ${String(owner?.lastName ?? '').trim()}`.trim();
  return {
    id: 'file-owner',
    name: name || email,
    role: 'Dosya Sorumlusu',
    email,
  };
}

/** Müşteri kartındaki genel e-posta — Alıcılar listesinde seçilebilir. */
export function claimApprovalCustomerCardContact(customer?: {
  email?: string | null;
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  name?: string | null;
} | null): MailContact | null {
  const email = String(customer?.email ?? '').trim();
  if (!email.includes('@')) return null;
  const name =
    String(customer?.shortName ?? '').trim()
    || String(customer?.companyName ?? '').trim()
    || String(customer?.fullName ?? '').trim()
    || String(customer?.name ?? '').trim()
    || email;
  return {
    id: 'customer-card',
    name,
    role: 'Müşteri Kartı',
    email,
  };
}

export function mergeClaimApprovalCustomerCardContact(
  contacts: MailContact[],
  customer?: {
    email?: string | null;
    shortName?: string | null;
    companyName?: string | null;
    fullName?: string | null;
    name?: string | null;
  } | null,
): MailContact[] {
  const row = claimApprovalCustomerCardContact(customer);
  if (!row) return contacts;
  const key = row.email.trim().toLowerCase();
  if (contacts.some((c) => c.email.trim().toLowerCase() === key)) return contacts;
  return [row, ...contacts];
}

/** Tercih edilen kanal + müşteri kartı genel adresi varsayılan Kime. */
export function claimApprovalDefaultToEmailsWithCustomerCard(
  contacts: MailContact[],
  preferredEmails: string[],
  customerEmail?: string | null,
): string[] {
  const defaults = claimApprovalDefaultToEmails(contacts, preferredEmails);
  const card = String(customerEmail ?? '').trim();
  if (!card.includes('@')) return defaults;
  const key = foldEmail(card);
  if (defaults.some((email) => foldEmail(email) === key)) return defaults;
  if (!contacts.some((row) => foldEmail(row.email) === key)) return defaults;
  return [...defaults, card];
}

export function mergeClaimApprovalFileOwnerContact(
  contacts: MailContact[],
  owner?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): MailContact[] {
  const row = claimApprovalFileOwnerContact(owner);
  if (!row) return contacts;
  const key = row.email.trim().toLowerCase();
  if (contacts.some((c) => c.email.trim().toLowerCase() === key)) return contacts;
  return [...contacts, row];
}

/** Varsayılan seçime dosya sorumlusunu Bilgi olarak ekler (Kime’deyse dokunmaz). */
export function withClaimApprovalFileOwnerCc(
  recipients: Array<MailContact & { delivery: 'to' | 'cc' | 'bcc' }>,
  owner?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): Array<MailContact & { delivery: 'to' | 'cc' | 'bcc' }> {
  const row = claimApprovalFileOwnerContact(owner);
  if (!row) return recipients;
  const key = row.email.trim().toLowerCase();
  if (recipients.some((r) => r.email.trim().toLowerCase() === key)) return recipients;
  return [...recipients, { ...row, delivery: 'cc' }];
}

export function claimApprovalMailTextPreview(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  fileNo?: string | null;
  reportNo?: string | null;
  insuranceCompanyName?: string | null;
  fileSubject?: string | null;
  customerName?: string | null;
  /** İlk Kime alıcısının adı — Hasar Tespit hitabında soyad. */
  recipientName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
}): {
  subject: string;
  greeting: string;
  body: string;
  messageText: string;
  documentTitle: string;
  fileNo: string;
  insuranceCompanyName: string;
  fileSubject: string;
  reportNo: string;
  attachmentNote: string;
  attachmentLabel: string;
  signatureName: string;
  signatureTitle: string;
  signaturePhone: string;
  signatureEmail: string;
} {
  const documentTitle = hasarReportDocumentTitle(
    input.serviceKind,
    input.consultancyServiceType,
  );
  const fileNo = String(input.fileNo ?? '').trim() || '—';
  const reportNo = String(input.reportNo ?? '').trim() || '—';
  const insuranceCompanyName = String(input.insuranceCompanyName ?? '').trim() || '—';
  const fileSubject = String(input.fileSubject ?? '').trim() || '—';
  const isTespit = documentTitle === 'Hasar Tespit Raporu';
  const greeting = isTespit
    ? claimApprovalGreeting(input.recipientName)
    : 'Sayın Eksperimiz,';
  const body = isTespit
    ? CLAIM_APPROVAL_TESPIT_BODY
    : `Dosyaya ait ${documentTitle} ekte yer almaktadır. İncelemenizi ve onayınızı rica ederiz.`;
  return {
    subject: buildClaimApprovalMailSubject(documentTitle, input.customerName, fileNo),
    greeting,
    body,
    messageText: `${greeting}\n\n${body}`,
    documentTitle,
    fileNo,
    insuranceCompanyName,
    fileSubject,
    reportNo,
    attachmentNote: `${documentTitle} PDF eki gider.`,
    attachmentLabel: `${documentTitle}.pdf`,
    signatureName: String(input.ownerName ?? '').trim() || '—',
    signatureTitle: 'Dosya Sorumlusu',
    signaturePhone: formatApprovalSignaturePhone(input.ownerPhone),
    signatureEmail: String(input.ownerEmail ?? '').trim(),
  };
}

/** İmza satırı: 0533 633 0713 (baştaki 0 durur). */
export function formatApprovalSignaturePhone(phone?: string | null): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('90') && digits.length >= 12
    ? digits.slice(2)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  if (local.length === 10) {
    return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return raw;
}
