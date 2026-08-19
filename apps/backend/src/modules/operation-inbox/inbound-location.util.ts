/** Adres metninden il / ilçe çıkarımı (province adı yoksa ilçe üzerinden). */

import { provinceSearchNames } from '../../common/helpers/turkey-location-normalize';

type ProvinceRow = { id: string; name: string };
type DistrictRow = { name: string; province: { name: string } };

function normalizeTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

/** Kısa / belirsiz ilçe adlarında yanlış pozitif önle (ör. "Of"). */
const MIN_PLACE_LEN = 3;

function includesPlaceName(haystack: string, place: string): boolean {
  const p = normalizeTr(place);
  if (p.length < MIN_PLACE_LEN) return false;
  const text = normalizeTr(haystack);
  let from = 0;
  while (from <= text.length) {
    const idx = text.indexOf(p, from);
    if (idx < 0) return false;
    const before = idx === 0 ? '' : text[idx - 1];
    const afterIdx = idx + p.length;
    const after = afterIdx >= text.length ? '' : text[afterIdx];
    const isBoundary = (ch: string) => !ch || /[^\p{L}\p{N}]/u.test(ch);
    if (isBoundary(before) && isBoundary(after)) return true;
    from = idx + 1;
  }
  return false;
}

export function matchCityDistrictFromAddressText(
  address: string,
  provinces: ProvinceRow[],
  districtsByProvinceId: Map<string, { name: string }[]>,
  allDistricts: DistrictRow[],
): { city: string | null; district: string | null } {
  const text = address.trim();
  if (!text) return { city: null, district: null };

  const sortedProvinces = [...provinces].sort((a, b) => b.name.length - a.name.length);
  let matchedProvince: ProvinceRow | null = null;
  for (const p of sortedProvinces) {
    const labels = provinceSearchNames(p.name).sort((a, b) => b.length - a.length);
    if (labels.some((label) => includesPlaceName(text, label))) {
      matchedProvince = p;
      break;
    }
  }

  if (matchedProvince) {
    const districts = districtsByProvinceId.get(matchedProvince.id) ?? [];
    const sorted = [...districts].sort((a, b) => b.name.length - a.name.length);
    let matchedDistrict: string | null = null;
    for (const d of sorted) {
      if (includesPlaceName(text, d.name)) {
        matchedDistrict = d.name;
        break;
      }
    }
    return { city: matchedProvince.name, district: matchedDistrict };
  }

  const sortedAll = [...allDistricts].sort((a, b) => b.name.length - a.name.length);
  for (const d of sortedAll) {
    if (includesPlaceName(text, d.name)) {
      return { city: d.province.name, district: d.name };
    }
  }

  return { city: null, district: null };
}

export async function resolveCityDistrictFromAddress(
  // PrismaService — findMany imzası çağrı yerinde gevşek tutulur
  prisma: any,
  address?: string | null,
): Promise<{ city: string | null; district: string | null }> {
  if (!address?.trim()) return { city: null, district: null };

  const provinces = await prisma.province.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const districts = await prisma.district.findMany({
    select: { name: true, provinceId: true, province: { select: { name: true } } },
  });

  const byProvince = new Map<string, { name: string }[]>();
  const allWithProvince: DistrictRow[] = [];
  for (const d of districts) {
    if (d.provinceId) {
      const list = byProvince.get(d.provinceId) ?? [];
      list.push({ name: d.name });
      byProvince.set(d.provinceId, list);
    }
    if (d.province?.name) {
      allWithProvince.push({ name: d.name, province: { name: d.province.name } });
    }
  }

  return matchCityDistrictFromAddressText(address, provinces, byProvince, allWithProvince);
}
