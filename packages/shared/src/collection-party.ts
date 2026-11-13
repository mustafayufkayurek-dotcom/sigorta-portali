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

/** Hasar Tespit hizmet bedeli dosyanın müşterisine (broker / özel müşteri) faturalanır. */
export const FILE_FEE_CUSTOMER_SOURCE = 'customer' as const;
export const HASAR_TESPIT_FEE_DESCRIPTION = 'Hasar Tespit Hizmet Bedeli';
/** Rapor müşteriye gönderildi (Onaya Gönder sonrası) — Hasar Tespit fatura talebi bu andan sonra açılır. */
export const HASAR_TESPIT_REPORT_SENT_STATUSES = [
  'pending_approval',
  'approved',
  'sent_for_external_approval',
  'externally_approved',
  'externally_rejected',
] as const;

/** Dosya bedeli kime yazılır. Hasar Tespit: dosya müşterisi. */
export function resolveFileFeeCollectionSource(input: {
  collectionParty?: string | null;
  insuranceCompanyId?: string | null;
  serviceKind?: string | null;
}): 'insurance_company' | 'insured' | 'customer' {
  if (String(input.serviceKind ?? '').trim().toLowerCase() === 'inspection') return FILE_FEE_CUSTOMER_SOURCE;
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
