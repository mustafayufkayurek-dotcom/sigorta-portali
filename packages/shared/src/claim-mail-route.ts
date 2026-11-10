/** Dosya açılırken seçilen mail tarafı. Sonraki yazışma bu kaydı okur. */

export const CLAIM_MAIL_LANES = [
  { key: 'approval', label: 'Onay' },
  { key: 'correspondence', label: 'Yazışma' },
] as const;

export type ClaimMailLane = (typeof CLAIM_MAIL_LANES)[number]['key'];
export type ClaimMailParty = 'insurance' | 'agency' | 'broker' | 'expert';


export type ClaimMailRoute = {
  approval: ClaimMailParty[];
  correspondence: ClaimMailParty[];
};

const PARTIES: ClaimMailParty[] = ['insurance', 'agency', 'broker', 'expert'];

function partyList(value: unknown): ClaimMailParty[] {
  if (!Array.isArray(value)) return [];
  const out: ClaimMailParty[] = [];
  for (const item of value) {
    if (PARTIES.includes(item as ClaimMailParty) && !out.includes(item as ClaimMailParty)) {
      out.push(item as ClaimMailParty);
    }
  }
  return out;
}

export function parseClaimMailRoute(value: unknown): ClaimMailRoute | null {
  let raw = value;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    try {
      raw = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { approval?: unknown; correspondence?: unknown };
  const approval = partyList(row.approval);
  const correspondence = partyList(row.correspondence);
  if (!approval.length && !correspondence.length) return null;
  return { approval, correspondence };
}

export function defaultClaimMailRoute(_input?: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
}): ClaimMailRoute | null {
  void _input;
  return null;
}

/** Dosyada yazılı tercih varsa o okunur. Yoksa hizmet ayarı devreye girer; ayar da yoksa dosyanın kendi kanalı durur. */
export function resolveClaimMailRoute(input: {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  mailRoute?: unknown;
  serviceMailRoute?: unknown;
}): ClaimMailRoute | null {
  return parseClaimMailRoute(input.mailRoute ?? input.mailRouteJson)
    ?? parseClaimMailRoute(input.serviceMailRoute)
    ?? defaultClaimMailRoute(input);
}

export function claimMailRouteJson(route: ClaimMailRoute | null): string | null {
  if (!route) return null;
  return JSON.stringify({ approval: route.approval, correspondence: route.correspondence });
}

export function claimMailRouteMissingParty(
  route: ClaimMailRoute | null,
  selected: { insurance?: unknown; agency?: unknown; broker?: unknown; expert?: unknown },
): ClaimMailParty | null {
  if (!route) return null;
  const present = (party: ClaimMailParty) => {
    const value = party === 'insurance' ? selected.insurance
      : party === 'agency' ? selected.agency
        : party === 'broker' ? selected.broker
          : selected.expert;
    return Boolean(String(value ?? '').trim());
  };
  for (const party of [...route.approval, ...route.correspondence]) {
    if (!present(party)) return party;
  }
  return null;
}

export const CLAIM_MAIL_PARTY_LABEL: Record<ClaimMailParty, string> = {
  insurance: 'Sigorta Şirketi',
  agency: 'Acente',
  broker: 'Broker',
  expert: 'Eksper',
};
