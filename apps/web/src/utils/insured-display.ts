/** Sigortalı adını müşteri kaydı veya dosya alanlarından çözümler */
export function resolveInsuredDisplayName(claimFile: {
  customer?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
  } | null;
  insuredName?: string | null;
  commercialTitle?: string | null;
} | null | undefined): string | undefined {
  if (!claimFile) return undefined;
  const customer = claimFile.customer;
  const fromCustomer =
    customer?.fullName?.trim()
    || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim()
    || customer?.companyName?.trim();
  return fromCustomer || claimFile.insuredName?.trim() || claimFile.commercialTitle?.trim() || undefined;
}
