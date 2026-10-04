/** Saha personeli kendi hizmet bölgesinde listelenir. Tüm Türkiye (bölge boş) her dosyada durur. Yabancı il durmaz. */

function norm(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

export type StaffServiceAreaLite = {
  provinceName?: string | null;
  districtName?: string | null;
};

/** Kullanıcılar «Tüm Türkiye» kaydı hizmet bölgesi boş bırakır. */
export function isCountrywideStaffServiceArea(
  areas: StaffServiceAreaLite[] | null | undefined,
): boolean {
  return !areas?.length;
}

export function userServiceAreaMatchesFile(
  areas: StaffServiceAreaLite[] | null | undefined,
  city?: string | null,
  district?: string | null,
): boolean {
  if (isCountrywideStaffServiceArea(areas)) return true;
  const cityN = norm(city);
  if (!cityN) return false;
  const districtN = norm(district);
  return areas!.some((area) => {
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
