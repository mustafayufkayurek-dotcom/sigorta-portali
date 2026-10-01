/** Saha personeli yalnız kendi hizmet bölgesinde listelenir. Bölgesi boş olan yabancı ile düşmez. */

function norm(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

export type StaffServiceAreaLite = {
  provinceName?: string | null;
  districtName?: string | null;
};

export function userServiceAreaMatchesFile(
  areas: StaffServiceAreaLite[] | null | undefined,
  city?: string | null,
  district?: string | null,
): boolean {
  if (!areas?.length) return false;
  const cityN = norm(city);
  if (!cityN) return false;
  const districtN = norm(district);
  return areas.some((area) => {
    const prov = norm(area.provinceName);
    if (!prov || prov !== cityN) return false;
    const areaDist = norm(area.districtName);
    if (!areaDist) return true;
    if (!districtN) return true;
    return areaDist === districtN;
  });
}

export function filterStaffByFileArea<T extends { serviceAreas?: StaffServiceAreaLite[] | null }>(
  staff: T[],
  city?: string | null,
  district?: string | null,
): T[] {
  return staff.filter((row) => userServiceAreaMatchesFile(row.serviceAreas, city, district));
}
