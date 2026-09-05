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

export function invoiceIssuedFileNo(inv: {
  claimFile?: { fileNo?: string | null; id?: string | null } | null;
  emergencyCase?: { fileNo?: string | null; caseNo?: string | null; id?: string | null } | null;
  claimFileId?: string | null;
  emergencyCaseId?: string | null;
}): string {
  return (
    inv.claimFile?.fileNo
    || inv.emergencyCase?.fileNo
    || inv.emergencyCase?.caseNo
    || inv.claimFileId
    || inv.emergencyCaseId
    || '—'
  );
}

export function invoiceIssuedFileHref(inv: {
  claimFile?: { id?: string | null } | null;
  emergencyCase?: { id?: string | null } | null;
  claimFileId?: string | null;
  emergencyCaseId?: string | null;
}): string | null {
  const emergencyId = inv.emergencyCase?.id || inv.emergencyCaseId;
  if (emergencyId) return `/panel/acil-yardim/${emergencyId}`;
  const claimId = inv.claimFile?.id || inv.claimFileId;
  if (claimId) return `/panel/hasar-dosyalari/${claimId}`;
  return null;
}
