import { sortByNameTR } from '@/utils/text-helpers';

/** Alfabetik sıradaki 1..n sıra numarası planı (DB sortOrder ile karşılaştırır). */
export function alphabeticSortOrderPlan<T extends { id: string; name: string; sortOrder?: number }>(
  items: T[],
): Array<{ id: string; sortOrder: number; changed: boolean }> {
  return sortByNameTR(items).map((item, idx) => {
    const sortOrder = idx + 1;
    return { id: item.id, sortOrder, changed: (item.sortOrder ?? 0) !== sortOrder };
  });
}

/** Kardeş kayıtların sortOrder alanını alfabetik 1..n olacak şekilde günceller. */
export async function persistAlphabeticSortOrders<T extends { id: string; name: string; sortOrder?: number }>(
  items: T[],
  update: (id: string, sortOrder: number) => Promise<void>,
): Promise<void> {
  const plan = alphabeticSortOrderPlan(items).filter((p) => p.changed);
  if (plan.length === 0) return;
  await Promise.all(plan.map((p) => update(p.id, p.sortOrder)));
}

/** Tek kayıt için alfabetik konum (1..n). */
export function computeAlphabeticSortOrder(
  name: string,
  siblings: Array<{ id?: string; name: string }>,
  excludeId?: string,
): number {
  const trimmed = name.trim();
  const names = siblings
    .filter((s) => s.id !== excludeId)
    .map((s) => s.name.trim());
  names.push(trimmed);
  names.sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));
  return names.indexOf(trimmed) + 1;
}

export { sortByNameTR } from '@/utils/text-helpers';
