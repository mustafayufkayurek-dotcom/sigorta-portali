/** Kapalı Hasar dosyasında ek onarım. Yeni dosya açılmaz; ilk kapanış durur. */

export const EXTRA_REPAIR_KIND = 'extra_repair';
export const EXTRA_REPAIR_TITLE = 'Ek Onarım';
export const EXTRA_REPAIR_STATUS_LABEL = 'Kapalı · Ek Onarım';
export const EXTRA_REPAIR_COST_HEADING = 'Ek Onarım Maliyeti';
export const EXTRA_REPAIR_COST_TOTAL_LABEL = 'Ek Onarım Toplamı';
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

export type ExtraRepairCostItemKeySource = {
  id?: string | null;
  workGroup?: { name?: string | null } | null;
  workGroupId?: string | null;
  jobDescription?: string | null;
};

/** İlk rapordaki kalem ile ek kalemi ayırır; iş grubu + iş tanımı. */
export function extraRepairCostItemKey(item: ExtraRepairCostItemKeySource): string {
  const group = String(item.workGroup?.name ?? item.workGroupId ?? '').trim().toLocaleLowerCase('tr-TR');
  const job = String(item.jobDescription ?? '').trim().toLocaleLowerCase('tr-TR');
  return `${group}\u0000${job}`;
}

export function partitionExtraRepairCostItems<T extends ExtraRepairCostItemKeySource>(input: {
  currentItems: T[];
  originalItems?: T[] | null;
  extraReportAlone?: boolean;
}): { originalItems: T[]; extraItems: T[] } {
  const current = Array.isArray(input.currentItems) ? input.currentItems : [];
  const original = Array.isArray(input.originalItems) ? input.originalItems : [];
  if (input.extraReportAlone) {
    return { originalItems: original, extraItems: current };
  }
  if (original.length === 0) {
    return { originalItems: current, extraItems: [] };
  }
  const remaining = new Map<string, number>();
  for (const row of original) {
    const key = extraRepairCostItemKey(row);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const originalItems: T[] = [];
  const extraItems: T[] = [];
  for (const row of current) {
    const key = extraRepairCostItemKey(row);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      originalItems.push(row);
    } else {
      extraItems.push(row);
    }
  }
  return { originalItems, extraItems };
}
