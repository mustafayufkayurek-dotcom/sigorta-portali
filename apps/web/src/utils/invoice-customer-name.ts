/** Fatura kesilecek müşteri — kısa ad, şirket, sigortalı veya sigorta. */
export function invoicePartyCustomerName(source: {
  collectionParty?: string | null;
  insuredName?: string | null;
  customer?: {
    shortName?: string | null;
    companyName?: string | null;
    fullName?: string | null;
  } | null;
  insuranceCompanyName?: string | null;
  emergencyCustomerName?: string | null;
}): string {
  const party = (source.collectionParty ?? '').trim();
  const insured = (source.insuredName ?? '').trim();
  if (party === 'insured' && insured) return insured;
  const c = source.customer;
  const fromCustomer = (c?.shortName || c?.companyName || c?.fullName || '').trim();
  if (fromCustomer) return fromCustomer;
  const emergency = (source.emergencyCustomerName ?? '').trim();
  if (emergency) return emergency;
  const insurer = (source.insuranceCompanyName ?? '').trim();
  if (insurer) return insurer;
  if (insured) return insured;
  return '—';
}
