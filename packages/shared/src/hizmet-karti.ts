/** Hizmetin menüsü ve maili Ayarlar kartındadır. Dosya açılışında sorulmaz. */

import type { ClaimMailParty } from './claim-mail-route';

export type HizmetGroup = 'asistans' | 'ek';
export type HizmetStep = 'hasar' | 'acil' | 'danismanlik';

export type HizmetKarti = {
  code: string;
  name: string;
  group: HizmetGroup;
  menuVisible: boolean;
  steps: HizmetStep;
  reportPrice: boolean;
  approvalParties: ClaimMailParty[];
  correspondenceParties: ClaimMailParty[];
  requiredParties: Array<'insurance' | 'broker' | 'expert'>;
  fixed?: boolean;
};

const PARTIES: ClaimMailParty[] = ['insurance', 'agency', 'broker', 'expert'];
const REQUIRED = ['insurance', 'broker', 'expert'] as const;

export const HIZMET_GROUP_LABEL: Record<HizmetGroup, string> = {
  asistans: 'Asistans Hizmetleri',
  ek: 'Ek Hizmetler',
};

export const HIZMET_STEP_LABEL: Record<HizmetStep, string> = {
  hasar: 'Hasar Onarım',
  acil: 'Acil Yardım',
  danismanlik: 'Danışmanlık',
};

export const BUILTIN_HIZMET_KARTLARI: HizmetKarti[] = [
  {
    code: 'hasar-onarim',
    name: 'Hasar Onarım',
    group: 'asistans',
    menuVisible: true,
    steps: 'hasar',
    reportPrice: true,
    approvalParties: ['insurance', 'expert'],
    correspondenceParties: ['insurance', 'expert'],
    requiredParties: ['insurance'],
    fixed: true,
  },
  {
    code: 'acil',
    name: 'Acil Yardım',
    group: 'asistans',
    menuVisible: true,
    steps: 'acil',
    reportPrice: false,
    approvalParties: ['insurance'],
    correspondenceParties: ['insurance'],
    requiredParties: [],
    fixed: true,
  },
  {
    // Hasar Onarım ve Restorasyon altında tespit: dosya bazında broker / özel müşteriye fiyatlı rapor yazılır.
    code: 'hasar-tespit',
    name: 'Hasar Tespit',
    group: 'ek',
    menuVisible: true,
    steps: 'hasar',
    reportPrice: true,
    approvalParties: ['insurance', 'broker', 'expert'],
    correspondenceParties: ['insurance'],
    requiredParties: ['insurance'],
    fixed: true,
  },
  {
    code: 'danismanlik',
    name: 'Danışmanlık',
    group: 'ek',
    menuVisible: true,
    steps: 'danismanlik',
    reportPrice: true,
    approvalParties: ['broker'],
    correspondenceParties: ['broker'],
    requiredParties: ['broker'],
    fixed: true,
  },
  {
    code: 'police-yonetimi',
    name: 'Poliçe Yönetimi',
    group: 'ek',
    menuVisible: true,
    steps: 'danismanlik',
    reportPrice: false,
    approvalParties: ['broker'],
    correspondenceParties: ['broker'],
    requiredParties: [],
    fixed: true,
  },
];

function partyList(value: unknown): ClaimMailParty[] {
  if (!Array.isArray(value)) return [];
  const out: ClaimMailParty[] = [];
  for (const item of value) {
    if (PARTIES.includes(item as ClaimMailParty) && !out.includes(item as ClaimMailParty)) out.push(item as ClaimMailParty);
  }
  return out;
}

function requiredList(value: unknown): HizmetKarti['requiredParties'] {
  if (!Array.isArray(value)) return [];
  const out: HizmetKarti['requiredParties'] = [];
  for (const item of value) {
    if ((REQUIRED as readonly string[]).includes(item) && !out.includes(item as HizmetKarti['requiredParties'][number])) {
      out.push(item as HizmetKarti['requiredParties'][number]);
    }
  }
  return out;
}

export function parseHizmetKarti(value: unknown, fallback?: HizmetKarti): HizmetKarti | null {
  if (!value || typeof value !== 'object') return fallback ?? null;
  const row = value as Partial<HizmetKarti>;
  const code = String(row.code ?? fallback?.code ?? '').trim();
  const name = String(row.name ?? fallback?.name ?? '').trim();
  if (!code || !name) return null;
  const group: HizmetGroup = row.group === 'asistans' || row.group === 'ek' ? row.group : (fallback?.group ?? 'ek');
  const steps: HizmetStep = row.steps === 'hasar' || row.steps === 'acil' || row.steps === 'danismanlik'
    ? row.steps
    : (fallback?.steps ?? 'danismanlik');
  return {
    code,
    name,
    group,
    menuVisible: row.menuVisible !== false,
    steps,
    reportPrice: row.reportPrice === true || (row.reportPrice == null && Boolean(fallback?.reportPrice)),
    approvalParties: partyList(row.approvalParties).length ? partyList(row.approvalParties) : (fallback?.approvalParties ?? []),
    correspondenceParties: partyList(row.correspondenceParties).length ? partyList(row.correspondenceParties) : (fallback?.correspondenceParties ?? []),
    requiredParties: requiredList(row.requiredParties).length || Array.isArray(row.requiredParties)
      ? requiredList(row.requiredParties)
      : (fallback?.requiredParties ?? []),
    fixed: fallback?.fixed === true,
  };
}

export function mergeHizmetKartlari(
  saved: unknown,
  extras: { name: string; code?: string | null; group?: HizmetGroup }[] = [],
): HizmetKarti[] {
  const rows = Array.isArray(saved) ? saved : [];
  const byCode = new Map<string, HizmetKarti>();
  for (const base of BUILTIN_HIZMET_KARTLARI) {
    const found = rows.find((row) => String((row as HizmetKarti)?.code ?? '') === base.code);
    byCode.set(base.code, parseHizmetKarti(found, base) ?? base);
  }
  for (const extra of extras) {
    const code = String(extra.code ?? '').trim();
    const name = String(extra.name ?? '').trim();
    if (!code || !name || byCode.has(code)) continue;
    const found = rows.find((row) => String((row as HizmetKarti)?.code ?? '') === code);
    const card = parseHizmetKarti(found, {
      code,
      name,
      group: extra.group ?? 'ek',
      menuVisible: true,
      steps: 'danismanlik',
      reportPrice: true,
      approvalParties: ['broker'],
      correspondenceParties: ['broker'],
      requiredParties: [],
    });
    if (card) byCode.set(code, { ...card, name });
  }
  for (const row of rows) {
    const code = String((row as HizmetKarti)?.code ?? '').trim();
    if (!code || byCode.has(code)) continue;
    const card = parseHizmetKarti(row);
    if (card) byCode.set(code, card);
  }
  return [...byCode.values()];
}

export function hizmetKartiCodeForClaim(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
}): string {
  const kind = String(input.serviceKind ?? '').trim().toLowerCase();
  const typeCode = String(input.consultancyServiceType?.code ?? '').trim().toLowerCase().replace(/_/g, '-');
  const typeName = String(input.consultancyServiceType?.name ?? '').trim().toLocaleLowerCase('tr-TR');
  if (kind === 'inspection' || kind === 'hasar-tespit' || typeCode === 'hasar-tespit' || typeCode === 'inspection' || typeName === 'hasar tespit') {
    return 'hasar-tespit';
  }
  if (kind === 'consultancy' || typeCode) {
    if (typeCode && typeCode !== 'danismanlik' && typeCode !== 'consultancy') return typeCode;
    return 'danismanlik';
  }
  return 'hasar-onarim';
}

export function findHizmetKarti(cards: HizmetKarti[], code: string): HizmetKarti | undefined {
  const key = String(code ?? '').trim().toLowerCase();
  return cards.find((row) => row.code === key);
}

export function mailRouteFromHizmetKarti(card: HizmetKarti | null | undefined): {
  approval: ClaimMailParty[];
  correspondence: ClaimMailParty[];
} | null {
  if (!card) return null;
  if (!card.approvalParties.length && !card.correspondenceParties.length) return null;
  return {
    approval: [...card.approvalParties],
    correspondence: [...card.correspondenceParties],
  };
}

export function missingHizmetRequiredParty(
  card: HizmetKarti | null | undefined,
  selected: { insurance?: unknown; broker?: unknown; expert?: unknown },
): HizmetKarti['requiredParties'][number] | null {
  if (!card) return null;
  const present = (value: unknown) => String(value ?? '').trim().length > 0;
  for (const party of card.requiredParties) {
    if (party === 'insurance' && !present(selected.insurance)) return party;
    if (party === 'broker' && !present(selected.broker)) return party;
    if (party === 'expert' && !present(selected.expert)) return party;
  }
  return null;
}

const REQUIRED_PARTY_LABEL: Record<HizmetKarti['requiredParties'][number], string> = {
  insurance: 'Sigorta Şirketi',
  broker: 'Broker',
  expert: 'Eksper',
};

export function hizmetRequiredPartyMessage(party: HizmetKarti['requiredParties'][number]): string {
  return `${REQUIRED_PARTY_LABEL[party]} zorunludur.`;
}

export function hizmetCodeFromName(name: string): string {
  const folded = name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return folded || 'hizmet';
}
