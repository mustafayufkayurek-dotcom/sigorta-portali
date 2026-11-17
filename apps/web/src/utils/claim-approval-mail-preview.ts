import {
  CLAIM_MAIL_PARTY_LABEL,
  HASAR_TESPIT_MUHATAP_SIRASI,
  collectClaimFileChannelEmails,
  hizmetKartiCodeForClaim,
  resolveClaimMailRoute,
  type ClaimMailParty,
  type ClaimMailRoute,
} from '@sigorta/shared';

export type ApprovalMailPreviewRow = {
  party: ClaimMailParty;
  label: string;
  email: string;
  name: string;
};

type ChannelParty = {
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  shortName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  contacts?: Array<{ name?: string | null; email?: string | null; isPrimary?: boolean | null }> | null;
  contactInfos?: Array<{ type?: string | null; label?: string | null; value?: string | null }> | null;
} | null | undefined;

function partyName(row: ChannelParty, fallback: string): string {
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

function firstEmail(party: ClaimMailParty, input: {
  insuranceContactEmail?: string | null;
  agency?: ChannelParty;
  broker?: ChannelParty;
  expert?: ChannelParty;
}): string {
  if (party === 'insurance') {
    const list = collectClaimFileChannelEmails({
      insuranceContactEmail: input.insuranceContactEmail,
    });
    return list[0] ?? '';
  }
  if (party === 'agency') {
    return collectClaimFileChannelEmails({ agency: input.agency })[0] ?? '';
  }
  if (party === 'broker') {
    return collectClaimFileChannelEmails({ broker: input.broker })[0] ?? '';
  }
  return collectClaimFileChannelEmails({ expert: input.expert })[0] ?? '';
}

/** Onaya Gönder kutusu: tercih edilen taraf + e-posta (müşteri yetkilisi değil). */
export function claimApprovalMailPreview(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  serviceMailRoute?: unknown;
  insuranceCompany?: { name?: string | null; contactEmail?: string | null } | null;
  channelAgencyCustomer?: ChannelParty;
  channelBrokerCustomer?: ChannelParty;
  channelExpertCustomer?: ChannelParty;
}): ApprovalMailPreviewRow[] {
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

  const channel = {
    insuranceContactEmail: input.insuranceCompany?.contactEmail,
    agency: input.channelAgencyCustomer,
    broker: input.channelBrokerCustomer,
    expert: input.channelExpertCustomer,
  };
  const nameByParty: Record<ClaimMailParty, ChannelParty> = {
    insurance: input.insuranceCompany as ChannelParty,
    agency: input.channelAgencyCustomer,
    broker: input.channelBrokerCustomer,
    expert: input.channelExpertCustomer,
  };

  const out: ApprovalMailPreviewRow[] = [];
  const seen = new Set<string>();
  for (const party of parties) {
    const email = firstEmail(party, channel);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      party,
      label: CLAIM_MAIL_PARTY_LABEL[party],
      email,
      name: partyName(nameByParty[party], CLAIM_MAIL_PARTY_LABEL[party]),
    });
  }
  return out;
}

export function claimApprovalMailPreviewEmails(
  rows: ApprovalMailPreviewRow[],
): string[] {
  return rows.map((row) => row.email);
}

/** Kanal e-postası yoksa (eski dosya) kart adresi yedektir — tercih edilen satır değil. */
export function claimApprovalFallbackCustomerEmail(customerEmail?: string | null): string {
  const email = String(customerEmail ?? '').trim();
  return email.includes('@') ? email : '';
}

export function collectPreviewChannelEmails(input: {
  insuranceContactEmail?: string | null;
  agency?: ChannelParty;
  broker?: ChannelParty;
  expert?: ChannelParty;
}): string[] {
  return collectClaimFileChannelEmails({
    insuranceContactEmail: input.insuranceContactEmail,
    agency: input.agency,
    broker: input.broker,
    expert: input.expert,
  });
}
