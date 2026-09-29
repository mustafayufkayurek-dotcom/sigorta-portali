/** Çoklu hasar PDF ara toplamı hasar nedenine göredir; iş grubuna değil. */

export type RepairPdfGroupKind = 'workGroup' | 'damageCause';

export type RepairPdfGroupItem = {
  damageTypeId?: string | null;
  damageType?: { id?: string | null; damageTypeName?: string | null } | null;
  workGroup?: { name?: string | null } | null;
  salesTotal?: number | null;
};

export type RepairPdfDamageType = {
  id: string;
  damageTypeName: string;
};

export function repairPdfItemGroupKind(
  reportType: string | null | undefined,
  damageTypeCount: number,
): RepairPdfGroupKind {
  if (reportType === 'multi' && damageTypeCount > 0) return 'damageCause';
  return 'workGroup';
}

export function itemMatchesRepairDamageType(
  item: RepairPdfGroupItem,
  damageType: RepairPdfDamageType,
): boolean {
  const itemId = String(item.damageTypeId ?? item.damageType?.id ?? '').trim();
  if (itemId && itemId === damageType.id) return true;
  const itemName = String(item.damageType?.damageTypeName ?? '').trim();
  const typeName = String(damageType.damageTypeName ?? '').trim();
  return Boolean(itemName && typeName && itemName === typeName);
}

export function pdfGroupTotalLabel(name: string, kind: RepairPdfGroupKind): string {
  const raw = (name || 'Diğer').trim() || 'Diğer';
  const folded = raw.toLocaleLowerCase('tr-TR');
  if (folded.endsWith('toplamı')) return raw;
  if (kind === 'damageCause') return `${raw} Toplamı`;
  const stripped = raw.replace(/\s*iş grubu$/i, '').trim() || 'Diğer';
  if (stripped.toLocaleLowerCase('tr-TR').endsWith('işleri')) return `${stripped} Toplamı`;
  return `${stripped} İşleri Toplamı`;
}

export function groupRepairPdfItemsByWorkGroup<T extends RepairPdfGroupItem>(
  items: T[],
): Array<{ key: string; label: string; items: T[] }> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = item.workGroup?.name?.trim() || 'Diğer';
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  return [...grouped.entries()].map(([label, rows]) => ({ key: label, label, items: rows }));
}

export function groupRepairPdfItemsByDamageCause<T extends RepairPdfGroupItem>(
  items: T[],
  damageTypes: RepairPdfDamageType[],
): Array<{ key: string; label: string; items: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const dt of damageTypes) {
    buckets.set(dt.id, []);
  }
  const unmatched: T[] = [];
  for (const item of items) {
    const hit = damageTypes.find((dt) => itemMatchesRepairDamageType(item, dt));
    if (hit) {
      buckets.get(hit.id)!.push(item);
    } else {
      unmatched.push(item);
    }
  }
  const result = damageTypes
    .filter((dt) => (buckets.get(dt.id)?.length ?? 0) > 0)
    .map((dt) => ({
      key: dt.id,
      label: dt.damageTypeName.trim() || 'Diğer',
      items: buckets.get(dt.id)!,
    }));
  if (unmatched.length > 0) {
    result.push({ key: 'unassigned', label: 'Hasar nedeni seçilmedi', items: unmatched });
  }
  return result;
}

export function groupRepairPdfItems<T extends RepairPdfGroupItem>(
  items: T[],
  reportType: string | null | undefined,
  damageTypes: RepairPdfDamageType[],
): Array<{ key: string; label: string; items: T[] }> {
  if (repairPdfItemGroupKind(reportType, damageTypes.length) === 'damageCause') {
    return groupRepairPdfItemsByDamageCause(items, damageTypes);
  }
  return groupRepairPdfItemsByWorkGroup(items);
}
