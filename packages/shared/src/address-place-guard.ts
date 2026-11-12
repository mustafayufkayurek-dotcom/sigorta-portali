export type AddressPlaceProvince = {
  plateCode: number;
  name: string;
  districts: string[];
};

export type OpenAddressPlace = {
  city: string | null;
  district: string | null;
  conflict: string | null;
};

function foldPlace(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordHits(text: string, name: string): number[] {
  const folded = foldPlace(name);
  if (folded.length < 4 || folded === 'merkez') return [];
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeReg(folded)}(?=[^a-z0-9]|$)`, 'g');
  const hits: number[] = [];
  for (const match of text.matchAll(re)) {
    const at = (match.index ?? 0) + match[0].length - folded.length;
    const after = text.slice(at + folded.length, at + folded.length + 12);
    if (/^\s*mah(?:alle(?:si)?)?\b/.test(after)) continue;
    hits.push(at);
  }
  return hits;
}

function placeLabel(city: string | null, district: string | null): string {
  if (district && city) return `${district}, ${city}`;
  return city || district || '';
}

/**
 * Açık adresteki il ve ilçeyi okur.
 * Posta kodunun ilk iki hanesi il plakasıdır.
 * Mahalle adı ilçe sanılmaz. Seçilen il ile çelişirse kayıt cümlesi döner.
 */
export function readOpenAddressPlace(
  openAddress: string,
  catalog: AddressPlaceProvince[],
  selected?: { city?: string | null; district?: string | null },
): OpenAddressPlace {
  const text = foldPlace(openAddress || '');
  const byPlate = new Map(catalog.map((row) => [row.plateCode, row]));
  const postalCities: AddressPlaceProvince[] = [];
  for (const match of text.matchAll(/\b(\d{5})\b/g)) {
    const plate = Number(match[1].slice(0, 2));
    const province = byPlate.get(plate);
    if (province && !postalCities.some((row) => row.plateCode === province.plateCode)) {
      postalCities.push(province);
    }
  }

  const namedCities = catalog.filter((row) => wordHits(text, row.name).length > 0);
  const citySignals = [...postalCities];
  for (const row of namedCities) {
    if (!citySignals.some((item) => item.plateCode === row.plateCode)) citySignals.push(row);
  }

  if (citySignals.length > 1) {
    return {
      city: null,
      district: null,
      conflict: 'Açık adres birden fazla il diyor. Kayıt durdu.',
    };
  }

  const city = citySignals[0] ?? null;
  type DistrictHit = { name: string; province: AddressPlaceProvince; at: number };
  const districtHits: DistrictHit[] = [];
  for (const province of catalog) {
    const names = [...province.districts].sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (city && province.plateCode !== city.plateCode) continue;
      for (const at of wordHits(text, name)) {
        const covered = districtHits.some((hit) => at >= hit.at && at < hit.at + hit.name.length);
        if (covered) continue;
        districtHits.push({ name, province, at });
      }
    }
  }

  const districtProvinces = new Map<number, AddressPlaceProvince>();
  for (const hit of districtHits) districtProvinces.set(hit.province.plateCode, hit.province);
  if (!city && districtProvinces.size > 1) {
    return {
      city: null,
      district: null,
      conflict: 'Açık adres birden fazla il diyor. Kayıt durdu.',
    };
  }

  const resolvedCity = city ?? (districtProvinces.size === 1 ? [...districtProvinces.values()][0] : null);
  const inCity = resolvedCity
    ? districtHits.filter((hit) => hit.province.plateCode === resolvedCity.plateCode)
    : [];
  const district = inCity.sort((a, b) => a.at - b.at).at(-1)?.name ?? null;
  const selectedCity = selected?.city?.trim() || '';
  const selectedDistrict = selected?.district?.trim() || '';
  const found = placeLabel(resolvedCity?.name ?? null, district);

  if (!resolvedCity && !district) {
    return { city: null, district: null, conflict: null };
  }
  if (resolvedCity && foldPlace(selectedCity) !== foldPlace(resolvedCity.name)) {
    return {
      city: resolvedCity.name,
      district,
      conflict: `Açık adres ${found} diyor. Seçilen il ${selectedCity || 'boş'}. Kayıt durdu.`,
    };
  }
  if (district && foldPlace(selectedDistrict) !== foldPlace(district)) {
    return {
      city: resolvedCity?.name ?? null,
      district,
      conflict: `Açık adres ${found} diyor. Seçilen ilçe ${selectedDistrict || 'boş'}. Kayıt durdu.`,
    };
  }
  return { city: resolvedCity?.name ?? null, district, conflict: null };
}
