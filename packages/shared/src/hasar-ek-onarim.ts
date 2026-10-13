/** Kapalı Hasar dosyasında ek onarım. Yeni dosya açılmaz; ilk kapanış durur. */

export const EXTRA_REPAIR_KIND = 'extra_repair';
export const EXTRA_REPAIR_TITLE = 'Ek Onarım';
export const EXTRA_REPAIR_STATUS_LABEL = 'Kapalı · Ek Onarım';
export const EXTRA_REPAIR_OPEN_STATUSES = ['draft', 'approved'] as const;
export const EXTRA_REPAIR_REASON_MIN = 8;

export type ExtraRepairOpenStatus = (typeof EXTRA_REPAIR_OPEN_STATUSES)[number];

export function isExtraRepairKind(kind?: string | null): boolean {
  return String(kind ?? '').trim() === EXTRA_REPAIR_KIND;
}

export function isOpenExtraRepairStatus(status?: string | null): boolean {
  return (EXTRA_REPAIR_OPEN_STATUSES as readonly string[]).includes(String(status ?? '').trim());
}

export function hasOpenExtraRepair(
  items?: Array<{ kind?: string | null; status?: string | null }> | null,
): boolean {
  return (items ?? []).some((row) => isExtraRepairKind(row.kind) && isOpenExtraRepairStatus(row.status));
}

export function canOpenHasarExtraRepair(input: {
  fileClosed?: boolean | null;
  fileCancelled?: boolean | null;
  extraRepairOpen?: boolean | null;
}): boolean {
  return Boolean(input.fileClosed) && !input.fileCancelled && !input.extraRepairOpen;
}

export function extraRepairReasonOk(reason?: string | null): boolean {
  return String(reason ?? '').trim().length >= EXTRA_REPAIR_REASON_MIN;
}
