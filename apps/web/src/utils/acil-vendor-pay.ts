/** Acil liste / dosya — tedarikçi ödemesi görünümü */

export type AcilVendorPayFilter = '' | 'paid' | 'unpaid' | 'none';

export function acilVendorPayLabel(paid: boolean | null | undefined): string {
  if (paid === true) return 'Ödendi';
  if (paid === false) return 'Ödenmedi';
  return 'Kayıt yok';
}

export function acilVendorPayTone(paid: boolean | null | undefined): string {
  if (paid === true) return 'badge badge-green';
  if (paid === false) return 'badge badge-amber';
  return 'badge badge-gray';
}

export function acilVendorPayMatchesFilter(
  paid: boolean | null | undefined,
  filter: AcilVendorPayFilter,
): boolean {
  if (!filter) return true;
  if (filter === 'paid') return paid === true;
  if (filter === 'unpaid') return paid === false;
  return paid !== true && paid !== false;
}

export function acilVendorPayMatchesQuery(
  paid: boolean | null | undefined,
  q: string,
): boolean {
  if (!q) return false;
  return acilVendorPayLabel(paid).toLocaleLowerCase('tr').includes(q);
}
