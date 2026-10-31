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
}): string | undefined {
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
