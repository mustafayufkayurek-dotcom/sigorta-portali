/** Yeni Dosya müşteri kaynağı. Özel müşteri tek başına da, diğer üçünün altında da durur. */

export const CLAIM_CUSTOMER_SOURCES = ['insurance', 'broker', 'expert', 'private'] as const;
export type ClaimCustomerSource = (typeof CLAIM_CUSTOMER_SOURCES)[number];

export const CLAIM_CUSTOMER_SOURCE_LABEL: Record<ClaimCustomerSource, string> = {
  insurance: 'Sigorta Şirketi',
  broker: 'Broker',
  expert: 'Eksper Ofisi',
  private: 'Özel Müşteri',
};

export function parseClaimCustomerSource(raw: unknown): ClaimCustomerSource {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'insurance' || v === 'sigorta' || v === 'sigorta_sirketi') return 'insurance';
  if (v === 'broker' || v === 'broker_firmasi') return 'broker';
  if (v === 'private' || v === 'ozel' || v === 'private_customer') return 'private';
  return 'expert';
}

export function claimCustomerSourceSubType(source: ClaimCustomerSource): string {
  if (source === 'insurance') return 'sigorta_sirketi';
  if (source === 'broker') return 'broker_firmasi';
  if (source === 'private') return 'private_customer';
  return 'eksper_firmasi';
}

export function claimCustomerSourceHidesChannel(
  source: ClaimCustomerSource,
  channel: 'insurance' | 'broker' | 'expert',
): boolean {
  return source === channel;
}

export function claimCustomerSourceFromSubType(subType: unknown): ClaimCustomerSource {
  const v = String(subType ?? '').trim();
  if (v === 'sigorta_sirketi') return 'insurance';
  if (v === 'broker_firmasi') return 'broker';
  if (v === 'private_customer') return 'private';
  if (v === 'eksper_firmasi') return 'expert';
  return 'expert';
}

export function claimCustomerSourceContactLabel(source: ClaimCustomerSource): string | null {
  if (source === 'insurance') return 'Dosya Sorumlusu (Sigorta Şirketi)';
  if (source === 'broker') return 'Broker Dosya Sorumlusu';
  if (source === 'expert') return 'Eksper Dosya Sorumlusu';
  return null;
}

export function claimCustomerSourceAllowsPrivateAlongside(source: ClaimCustomerSource): boolean {
  return source !== 'private';
}
