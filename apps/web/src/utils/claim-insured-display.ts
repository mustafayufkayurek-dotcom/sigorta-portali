import { toTitleCaseTR } from '@/utils/text-helpers';

/** Hasar dosyasında sigortalı adını gösterir — müşteri kartı kurumsal/eksper ise karıştırmaz. */
export function resolveHasarInsuredName(claim: {
  insuredName?: string | null;
  customer?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    entityType?: string | null;
    type?: string | null;
  } | null;
}): string {
  if (claim.insuredName?.trim()) {
    return toTitleCaseTR(claim.insuredName.trim());
  }
  const customer = claim.customer;
  if (!customer) return '—';
  const entityType = String(customer.entityType ?? customer.type ?? '').trim().toLowerCase();
  if (entityType === 'corporate') return '—';
  const composed = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    || customer.fullName?.trim()
    || '';
  return composed ? toTitleCaseTR(composed) : '—';
}
