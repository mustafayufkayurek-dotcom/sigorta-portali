/** Hasar tedarikçi sözleşmesi: tek metin; 100.000 eşiği yoktur. */

export const HASAR_VENDOR_CONTRACT_DETAILED_MIN_TL = 100_000;

export type HasarVendorContractKind = 'simple' | 'detailed';

export type VendorContractPurpose = 'hasar_onarim' | 'acil_hizmet';

export type VendorContractCorrectionRequest = {
  note: string;
  requestedByUserId: string;
  requestedAt: string;
  status: 'pending' | 'resolved';
};

export function resolveHasarVendorContractKind(_amountTl?: number): HasarVendorContractKind {
  return 'detailed';
}

export function readVendorContractKind(workItems: unknown): HasarVendorContractKind {
  if (workItems && typeof workItems === 'object' && !Array.isArray(workItems)) {
    const kind = (workItems as { kind?: unknown }).kind;
    if (kind === 'simple' || kind === 'detailed') return kind;
  }
  return 'detailed';
}

export function wrapVendorContractWorkItems(
  kind: HasarVendorContractKind,
  items: unknown[],
  extra?: {
    correctionRequest?: VendorContractCorrectionRequest | null;
    purpose?: VendorContractPurpose;
  },
): {
  kind: HasarVendorContractKind;
  items: unknown[];
  correctionRequest?: VendorContractCorrectionRequest | null;
  purpose?: VendorContractPurpose;
} {
  const out: {
    kind: HasarVendorContractKind;
    items: unknown[];
    correctionRequest?: VendorContractCorrectionRequest | null;
    purpose?: VendorContractPurpose;
  } = extra?.correctionRequest
    ? { kind, items, correctionRequest: extra.correctionRequest }
    : { kind, items };
  if (extra?.purpose) out.purpose = extra.purpose;
  return out;
}

export function readVendorContractPurpose(workItems: unknown): VendorContractPurpose {
  if (workItems && typeof workItems === 'object' && !Array.isArray(workItems)) {
    const purpose = (workItems as { purpose?: unknown }).purpose;
    if (purpose === 'acil_hizmet') return 'acil_hizmet';
  }
  return 'hasar_onarim';
}

export function unwrapVendorContractWorkItems(workItems: unknown): unknown[] {
  if (Array.isArray(workItems)) return workItems;
  if (workItems && typeof workItems === 'object') {
    const items = (workItems as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

export function readVendorContractCorrectionRequest(
  workItems: unknown,
): VendorContractCorrectionRequest | null {
  if (!workItems || typeof workItems !== 'object' || Array.isArray(workItems)) return null;
  const raw = (workItems as { correctionRequest?: unknown }).correctionRequest;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as VendorContractCorrectionRequest;
  if (row.status !== 'pending' && row.status !== 'resolved') return null;
  if (!row.note || !row.requestedByUserId || !row.requestedAt) return null;
  return row;
}

export function hasarVendorContractKindLabel(_kind?: HasarVendorContractKind): string {
  return 'Tedarikçi Sözleşmesi';
}

export function isVendorContractManagerRole(roleCode: string | null | undefined): boolean {
  const c = String(roleCode ?? '').toLowerCase();
  return c === 'admin' || c === 'manager' || c === 'ops_manager';
}
