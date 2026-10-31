/** Dosyayı biz açarız. Rapor ve yazışma seçilen taraflara gider. */

export const CLAIM_FILE_CHANNEL_AGENCY_SUB_TYPE = 'acente_firmasi';

export type ClaimFileChannelKey = 'insurance' | 'agency' | 'broker' | 'expert';

export type ClaimFileChannelDef = {
  key: ClaimFileChannelKey;
  label: string;
  dataField: 'insuranceCompanyId' | 'channelAgencyCustomerId' | 'channelBrokerCustomerId' | 'channelExpertCustomerId';
  customerSubType: string | null;
};

export const CLAIM_FILE_CHANNELS: ClaimFileChannelDef[] = [
  { key: 'insurance', label: 'Sigorta Şirketi', dataField: 'insuranceCompanyId', customerSubType: null },
  { key: 'agency', label: 'Acente', dataField: 'channelAgencyCustomerId', customerSubType: CLAIM_FILE_CHANNEL_AGENCY_SUB_TYPE },
  { key: 'broker', label: 'Broker', dataField: 'channelBrokerCustomerId', customerSubType: 'broker_firmasi' },
  { key: 'expert', label: 'Eksper', dataField: 'channelExpertCustomerId', customerSubType: 'eksper_firmasi' },
];

type ChannelNameSource = {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined;

export function optionalClaimChannelCustomerId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id || null;
}

export function claimFileChannelCreateFields(input: {
  channelAgencyCustomerId?: unknown;
  channelBrokerCustomerId?: unknown;
  channelExpertCustomerId?: unknown;
}): {
  channelAgencyCustomerId: string | null;
  channelBrokerCustomerId: string | null;
  channelExpertCustomerId: string | null;
} {
  return {
    channelAgencyCustomerId: optionalClaimChannelCustomerId(input.channelAgencyCustomerId),
    channelBrokerCustomerId: optionalClaimChannelCustomerId(input.channelBrokerCustomerId),
    channelExpertCustomerId: optionalClaimChannelCustomerId(input.channelExpertCustomerId),
  };
}

export function claimChannelFirmLabel(c: ChannelNameSource): string {
  const short = String(c?.shortName ?? '').trim();
  if (short) return short;
  const company = String(c?.companyName ?? '').trim();
  if (company) return company;
  const full = String(c?.fullName ?? '').trim();
  if (full) return full;
  return `${String(c?.firstName ?? '').trim()} ${String(c?.lastName ?? '').trim()}`.trim();
}

export function claimFileChannelSummaryRows(claim: {
  insuranceCompany?: { name?: string | null } | null;
  channelAgencyCustomer?: ChannelNameSource;
  channelBrokerCustomer?: ChannelNameSource;
  channelExpertCustomer?: ChannelNameSource;
}): { label: string; value: string }[] {
  return [
    { label: 'Sigorta Şirketi', value: String(claim.insuranceCompany?.name ?? '').trim() || '—' },
    { label: 'Acente', value: claimChannelFirmLabel(claim.channelAgencyCustomer) || '—' },
    { label: 'Broker', value: claimChannelFirmLabel(claim.channelBrokerCustomer) || '—' },
    { label: 'Eksper', value: claimChannelFirmLabel(claim.channelExpertCustomer) || '—' },
  ];
}

export type ClaimFileChannelMailParty = {
  email?: string | null;
  contacts?: Array<{ email?: string | null; isPrimary?: boolean | null }> | null;
  contactInfos?: Array<{ type?: string | null; label?: string | null; value?: string | null }> | null;
} | null | undefined;

const CHANNEL_MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pushUniqueEmails(out: string[], seen: Set<string>, raw?: string | null) {
  for (const part of String(raw ?? '').split(/[;,\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !CHANNEL_MAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
}

function emailsFromChannelParty(party: ClaimFileChannelMailParty): string[] {
  if (!party) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  pushUniqueEmails(out, seen, party.email);
  const contacts = Array.isArray(party.contacts) ? party.contacts : [];
  const primary = contacts.find((row) => row?.isPrimary);
  pushUniqueEmails(out, seen, primary?.email ?? null);
  for (const row of contacts) pushUniqueEmails(out, seen, row?.email ?? null);
  for (const info of party.contactInfos ?? []) {
    const kind = String(info?.type ?? '').trim();
    const label = String(info?.label ?? 'general').trim().toLowerCase();
    if (kind !== 'email' || label !== 'general') continue;
    pushUniqueEmails(out, seen, info?.value ?? null);
  }
  return out;
}

/** Seçilen sigorta / acente / broker / eksper kutuları. Sessiz sigorta yedeği değildir. */
export function collectClaimFileChannelEmails(input: {
  insuranceContactEmail?: string | null;
  agency?: ClaimFileChannelMailParty;
  broker?: ClaimFileChannelMailParty;
  expert?: ClaimFileChannelMailParty;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  pushUniqueEmails(out, seen, input.insuranceContactEmail);
  for (const party of [input.agency, input.broker, input.expert]) {
    for (const email of emailsFromChannelParty(party)) {
      if (seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
