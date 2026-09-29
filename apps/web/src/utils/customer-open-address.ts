/** Aynı açık adres cümlesi kayıttan kayda üst üste binmesin. */
export function collapseRepeatedAddressLine(raw?: string | null): string {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < 40) return s;
  let prev = '';
  while (s !== prev) {
    prev = s;
    let found = '';
    for (let len = 20; len <= Math.floor(s.length / 2); len++) {
      const unit = s.slice(0, len).replace(/[,\s]+$/g, '').trim();
      if (unit.length < 20) continue;
      const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^(?:${escaped}[\\s,]*){2,}$`, 'u').test(s)) {
        found = unit;
        break;
      }
    }
    if (found) s = found;
    else break;
  }
  return s;
}

/** Kartta açık adres, mahalle/cadde ile aynıysa ikinci kez yazılmaz. */
export function customerCardOpenAddress(input: {
  address?: string | null;
  neighborhood?: string | null;
  streetName?: string | null;
}): string {
  const open = collapseRepeatedAddressLine(input.address);
  if (!open) return '';
  const fold = (v: string) => v.toLocaleLowerCase('tr-TR');
  const neigh = collapseRepeatedAddressLine(input.neighborhood);
  const street = String(input.streetName ?? '').replace(/\s+/g, ' ').trim();
  if (neigh && fold(open) === fold(neigh)) return '';
  if (street && fold(open) === fold(street)) return '';
  return open;
}
