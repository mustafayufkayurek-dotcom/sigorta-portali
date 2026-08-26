/**
 * Hasar listesi URL `?status=` çözümlemesi.
 * `open` / `closed` tek bir durum adına fuzzy eşleşmez — aksi halde
 * «Onarım Devam Ediyor» gibi isimler dizi boşaltır (saha ekranı regresyonu).
 * Personel filtresi ürün aşamasıdır; bütçe / eksper adları basılmaz.
 */

import {
  CLAIM_LIST_PRODUCT_STAGE_PREFIX,
  findHasarProductStageByClaimCode,
  hasarListStatusQuery,
  hasarProductStageFilterValue,
  parseHasarProductStageFilter,
} from '@sigorta/shared';

export type ClaimListUrlStatusKind = 'none' | 'open' | 'closed' | 'sla_exceeded' | 'productStage' | 'statusId';

export type ClaimListUrlStatus =
  | { kind: 'none' }
  | { kind: 'open' }
  | { kind: 'closed' }
  | { kind: 'sla_exceeded' }
  | { kind: 'productStage'; stageId: string }
  | { kind: 'statusId'; statusId: string };

type StatusRow = { id: string; code?: string | null; name?: string | null };

export function resolveClaimListUrlStatus(
  urlStatus: string | null | undefined,
  claimStatuses: StatusRow[] = [],
): ClaimListUrlStatus {
  const raw = String(urlStatus ?? '').trim();
  if (!raw) return { kind: 'none' };
  const lower = raw.toLowerCase();
  if (lower === 'open') return { kind: 'open' };
  if (lower === 'closed') return { kind: 'closed' };
  if (lower === 'sla_exceeded') return { kind: 'sla_exceeded' };

  const fromPrefix = parseHasarProductStageFilter(raw);
  if (fromPrefix) return { kind: 'productStage', stageId: fromPrefix.id };

  const byStageId = parseHasarProductStageFilter(hasarProductStageFilterValue(lower));
  if (byStageId && lower === byStageId.id) {
    return { kind: 'productStage', stageId: byStageId.id };
  }

  const byClaimCode = findHasarProductStageByClaimCode(lower);
  if (byClaimCode) return { kind: 'productStage', stageId: byClaimCode.id };

  const exact = claimStatuses.find((s) => String(s.code ?? '').trim().toLowerCase() === lower);
  if (exact) {
    const stage = findHasarProductStageByClaimCode(exact.code);
    if (stage) return { kind: 'productStage', stageId: stage.id };
    return { kind: 'statusId', statusId: exact.id };
  }

  const byId = claimStatuses.find((s) => s.id === raw);
  if (byId) {
    const stage = findHasarProductStageByClaimCode(byId.code);
    if (stage) return { kind: 'productStage', stageId: stage.id };
    return { kind: 'statusId', statusId: byId.id };
  }

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
    case 'productStage':
      return hasarProductStageFilterValue(resolved.stageId);
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
  const q = hasarListStatusQuery(statusFilter);
  if (q.slaExceeded) {
    params.set('slaExceeded', 'true');
    return;
  }
  if (q.statusCode) {
    params.set('statusCode', q.statusCode);
    return;
  }
  if (statusFilter.startsWith(CLAIM_LIST_PRODUCT_STAGE_PREFIX)) return;
  params.set('statusId', statusFilter);
}
