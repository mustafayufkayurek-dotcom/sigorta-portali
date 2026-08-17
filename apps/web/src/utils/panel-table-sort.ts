/** Panel tabloları — istemci tarafı sütun sıralama (asc → desc → varsayılan). */

export type ClientSortState = { key: string; dir: 'asc' | 'desc' } | null;

export function cycleClientSort(prev: ClientSortState, colId: string): ClientSortState {
  if (colId === 'actions' || colId === 'flow') return prev;
  if (!prev || prev.key !== colId) return { key: colId, dir: 'asc' };
  if (prev.dir === 'asc') return { key: colId, dir: 'desc' };
  return null;
}

export function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: 'asc' | 'desc',
): number {
  const mul = dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') {
    const an = Number.isFinite(a) ? a : 0;
    const bn = Number.isFinite(b) ? b : 0;
    return (an - bn) * mul;
  }
  return (
    String(a ?? '').localeCompare(String(b ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    }) * mul
  );
}

export function sortRowsByClientSort<T>(
  rows: T[],
  clientSort: ClientSortState,
  getValue: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (!clientSort) return rows;
  const { key, dir } = clientSort;
  return [...rows].sort((a, b) => compareSortValues(getValue(a, key), getValue(b, key), dir));
}
