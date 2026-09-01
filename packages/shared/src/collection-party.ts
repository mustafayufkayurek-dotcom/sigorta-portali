/** Hasar dosyası tahsilat tarafı: sigorta şirketi (varsayılan) veya sigortalı ödemeli. */

export const COLLECTION_PARTY = {
  insuranceCompany: 'insurance_company',
  insured: 'insured',
} as const;

export type CollectionParty = (typeof COLLECTION_PARTY)[keyof typeof COLLECTION_PARTY];

export function isCollectionParty(value: unknown): value is CollectionParty {
  return value === COLLECTION_PARTY.insuranceCompany || value === COLLECTION_PARTY.insured;
}

export function parseCollectionParty(value: unknown): CollectionParty | null {
  return isCollectionParty(value) ? value : null;
}

export function isInsuredCollectionParty(value?: string | null): boolean {
  return value === COLLECTION_PARTY.insured;
}

/** Onaylı rapordan düşen dosya bedeli kime yazılır. */
export function resolveFileFeeCollectionSource(input: {
  collectionParty?: string | null;
  insuranceCompanyId?: string | null;
}): 'insurance_company' | 'insured' {
  if (isInsuredCollectionParty(input.collectionParty)) return 'insured';
  return input.insuranceCompanyId ? 'insurance_company' : 'insured';
}

export function defaultInvoiceCounterpartyType(
  collectionParty?: string | null,
): 'insurance_company' | 'insured' {
  return isInsuredCollectionParty(collectionParty) ? 'insured' : 'insurance_company';
}

export function defaultPaymentPayerType(
  collectionParty?: string | null,
): 'insurance_company' | 'insured' {
  return isInsuredCollectionParty(collectionParty) ? 'insured' : 'insurance_company';
}

export function collectionPartyLabel(value?: string | null): string {
  return isInsuredCollectionParty(value) ? 'Sigortalı ödemeli' : 'Sigorta Şirketi';
}

/** 4. adımda talep gittikten sonra kutu kapanır. */
export function hasarInvoiceRequestGoneLabel(value?: string | null): string {
  return isInsuredCollectionParty(value) ? 'Talep gitti · Sigortalı' : 'Talep gitti · Sigorta Şirketi';
}

export function canToggleCollectionPartyLock(roleCode?: string | null): boolean {
  return String(roleCode ?? '').trim().toLowerCase().replace(/\s+/g, '_') === 'admin';
}

export function isCollectionPartyChangeBlocked(input: {
  locked?: boolean | null;
  isAdmin?: boolean;
  unlocking?: boolean;
}): boolean {
  if (!input.locked) return false;
  if (input.isAdmin && input.unlocking) return false;
  return true;
}

/** Fatura / tahsilat karşı tarafı. «Müşteri» eksper kartıdır; sigortalı ayrıdır. */
export function financeCounterpartyLabel(type?: string | null): string {
  if (type === 'insured') return 'Sigortalı';
  if (type === 'insurance_company') return 'Sigorta Şirketi';
  if (type === 'vendor') return 'Tedarikçi';
  if (type === 'customer') return 'Müşteri';
  return type ? String(type) : '—';
}

export function coerceSalesInvoiceCounterparty(input: {
  collectionParty?: string | null;
  invoiceType?: string | null;
  counterpartyType?: string | null;
}): string {
  const type = String(input.counterpartyType ?? '').trim() || 'insurance_company';
  if (
    input.invoiceType === 'sales'
    && isInsuredCollectionParty(input.collectionParty)
    && (type === 'insurance_company' || type === 'customer' || !type)
  ) {
    return COLLECTION_PARTY.insured;
  }
  return type;
}

export function coerceIncomingPayerType(input: {
  collectionParty?: string | null;
  paymentType?: string | null;
  payerType?: string | null;
}): string {
  const type = String(input.payerType ?? '').trim() || 'insurance_company';
  if (
    input.paymentType === 'incoming'
    && isInsuredCollectionParty(input.collectionParty)
    && (type === 'insurance_company' || type === 'customer' || !type)
  ) {
    return COLLECTION_PARTY.insured;
  }
  return type;
}
