/**
 * Hasar listesi URL `?status=` çözümlemesi.
 * `open` / `closed` tek bir durum adına fuzzy eşleşmez — aksi halde
 * «Onarım Devam Ediyor» gibi isimler dizi boşaltır (saha ekranı regresyonu).
 */

export type ClaimListUrlStatusKind = 'none' | 'open' | 'closed' | 'sla_exceeded' | 'statusId';

export type ClaimListUrlStatus =
  | { kind: 'none' }
  | { kind: 'open' }
  | { kind: 'closed' }
  | { kind: 'sla_exceeded' }
  | { kind: 'statusId'; statusId: string };

type StatusRow = { id: string; code?: string | null; name?: string | null };

export function resolveClaimListUrlStatus(
  urlStatus: string | null | undefined,
  claimStatuses: StatusRow[] = [],
): ClaimListUrlStatus {
  const raw = String(urlStatus ?? '').trim().toLowerCase();
  if (!raw) return { kind: 'none' };
  if (raw === 'open') return { kind: 'open' };
  if (raw === 'closed') return { kind: 'closed' };
  if (raw === 'sla_exceeded') return { kind: 'sla_exceeded' };

  const exact = claimStatuses.find((s) => String(s.code ?? '').trim().toLowerCase() === raw);
  if (exact) return { kind: 'statusId', statusId: exact.id };
  return { kind: 'none' };
}

/** UI select / query sentinel — statusId ile karışmaz */
export const CLAIM_LIST_OPEN_FILTER = '__open__';
export const CLAIM_LIST_CLOSED_FILTER = '__closed__';
export const CLAIM_LIST_SLA_FILTER = '__sla_exceeded__';

export function claimListStatusFilterFromUrl(
  urlStatus: string | null | undefined,
  claimStatuses: StatusRow[] = [],
): string {
  const resolved = resolveClaimListUrlStatus(urlStatus, claimStatuses);
  switch (resolved.kind) {
    case 'open':
      return CLAIM_LIST_OPEN_FILTER;
    case 'closed':
      return CLAIM_LIST_CLOSED_FILTER;
    case 'sla_exceeded':
      return CLAIM_LIST_SLA_FILTER;
    case 'statusId':
      return resolved.statusId;
    default:
      return '';
  }
}

export function appendClaimListStatusParams(
  params: URLSearchParams,
  statusFilter: string,
): void {
  if (!statusFilter) return;
  if (statusFilter === CLAIM_LIST_SLA_FILTER) {
    params.set('slaExceeded', 'true');
    return;
  }
  if (statusFilter === CLAIM_LIST_OPEN_FILTER) {
    params.set('statusCode', 'open');
    return;
  }
  if (statusFilter === CLAIM_LIST_CLOSED_FILTER) {
    params.set('statusCode', 'closed');
    return;
  }
  params.set('statusId', statusFilter);
}
