import {
  CLAIM_MAIL_PARTY_LABEL,
  HASAR_TESPIT_MUHATAP_SIRASI,
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
    ? route.approval
    : hizmet === 'hasar-tespit'
      ? [...HASAR_TESPIT_MUHATAP_SIRASI]
      : (['insurance', 'expert'] as ClaimMailParty[]);

  const byParty: Record<ClaimMailParty, ChannelParty | { email?: string | null; name?: string | null }> = {
    insurance: {
      email: input.insuranceCompany?.contactEmail,
      name: input.insuranceCompany?.name,
      companyName: input.insuranceCompany?.name,
    },
    agency: input.channelAgencyCustomer,
    broker: input.channelBrokerCustomer,
    expert: input.channelExpertCustomer,
  };

  const out: MailContact[] = [];
  const seen = new Set<string>();
  for (const party of parties) {
    const role = CLAIM_MAIL_PARTY_LABEL[party];
    const row = byParty[party];
    if (!row) continue;
    const orgName = partyDisplayName(row as ChannelParty, role);
    pushContact(out, seen, {
      id: `${party}:org`,
      name: orgName,
      role,
      email: row.email,
    });
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

/** Kişi adından soyad; firma / tek kelime boş kalır. */
export function claimApprovalRecipientSurname(name?: string | null): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  if (/(sigorta|broker|eksper|ltd|a\.?\s?ş|assistance|asistans|şirket|firma|demo|pilot)/i.test(raw)) {
    return '';
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1] ?? '';
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
  recipients: Array<MailContact & { delivery: 'to' | 'cc' }>,
  owner?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): Array<MailContact & { delivery: 'to' | 'cc' }> {
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
  /** İlk Kime alıcısının adı — Hasar Tespit hitabında soyad. */
  recipientName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
}): {
  subject: string;
  greeting: string;
  body: string;
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
  const soyad = claimApprovalRecipientSurname(input.recipientName);
  return {
    subject: `${documentTitle} — ${fileNo}`,
    greeting: isTespit
      ? (soyad ? `Sayın ${soyad},` : 'Sayın Yetkili,')
      : 'Sayın Eksperimiz,',
    body: isTespit
      ? 'Dosyaya ait Hasar Tespit Raporu ekte bilgilerinize sunarız.'
      : `Dosyaya ait ${documentTitle} ekte yer almaktadır. İncelemenizi ve onayınızı rica ederiz.`,
    documentTitle,
    fileNo,
    insuranceCompanyName,
    fileSubject,
    reportNo,
    attachmentNote: `${documentTitle} PDF eki gider.`,
    attachmentLabel: `${documentTitle}.pdf`,
    signatureName: String(input.ownerName ?? '').trim() || '—',
    signatureTitle: 'Dosya Sorumlusu',
    signaturePhone: String(input.ownerPhone ?? '').trim(),
    signatureEmail: String(input.ownerEmail ?? '').trim(),
  };
}
