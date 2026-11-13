import {
  HASAR_TESPIT_MUHATAP_SIRASI,
  findHizmetKarti,
  hizmetKartiCodeForClaim,
  mailRouteFromHizmetKarti,
  resolveClaimMailRoute,
  type ClaimMailParty,
  type HizmetKarti,
} from '@sigorta/shared';

export function claimWithHizmetMailRoute<T extends {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
}>(claim: T, cards: HizmetKarti[]): T & { serviceMailRoute: ReturnType<typeof mailRouteFromHizmetKarti> } {
  const card = findHizmetKarti(cards, hizmetKartiCodeForClaim(claim));
  return { ...claim, serviceMailRoute: mailRouteFromHizmetKarti(card) };
}

/** Liste e-posta alıcısı: önce müşteri kartı, sonra seçilen dosya kanalı, sonra sigorta. */
export function resolveOpsEmailDefaultTo(input: {
  customerEmail?: string | null;
  insuranceEmail?: string | null;
  fileChannelEmails?: string[] | null;
}): string | undefined {
  const customer = input.customerEmail?.trim();
  if (customer && customer.includes('@')) return customer;
  for (const raw of input.fileChannelEmails ?? []) {
    const channel = String(raw ?? '').trim();
    if (channel && channel.includes('@')) return channel;
  }
  const insurance = input.insuranceEmail?.trim();
  if (insurance && insurance.includes('@')) return insurance;
  return undefined;
}

export function resolveClaimCorrespondenceDefaultTo(claim: {
  customer?: { email?: string | null } | null;
  insuranceCompany?: { contactEmail?: string | null } | null;
  channelAgencyCustomer?: { email?: string | null } | null;
  channelBrokerCustomer?: { email?: string | null } | null;
  channelExpertCustomer?: { email?: string | null } | null;
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  serviceMailRoute?: unknown;
}): string | undefined {
  const route = resolveClaimMailRoute({
    serviceKind: claim.serviceKind,
    consultancyServiceType: claim.consultancyServiceType,
    mailRouteJson: claim.mailRouteJson,
    serviceMailRoute: claim.serviceMailRoute,
  });
  if (route) {
    const byParty: Record<ClaimMailParty, string | null | undefined> = {
      insurance: claim.insuranceCompany?.contactEmail,
      agency: claim.channelAgencyCustomer?.email,
      broker: claim.channelBrokerCustomer?.email,
      expert: claim.channelExpertCustomer?.email,
    };
    for (const party of route.correspondence) {
      const email = String(byParty[party] ?? '').trim();
      if (email.includes('@')) return email;
    }
    // Hasar Tespit: tercih edilen tarafta adres yoksa Sigorta → Broker → Eksper.
    if (hizmetKartiCodeForClaim(claim) === 'hasar-tespit') {
      for (const party of HASAR_TESPIT_MUHATAP_SIRASI) {
        const email = String(byParty[party] ?? '').trim();
        if (email.includes('@')) return email;
      }
    }
    return undefined;
  }
  return resolveOpsEmailDefaultTo({
    customerEmail: claim.customer?.email,
    insuranceEmail: claim.insuranceCompany?.contactEmail,
    fileChannelEmails: [
      claim.insuranceCompany?.contactEmail,
      claim.channelAgencyCustomer?.email,
      claim.channelBrokerCustomer?.email,
      claim.channelExpertCustomer?.email,
    ].filter((value): value is string => Boolean(String(value ?? '').trim())),
  });
}
