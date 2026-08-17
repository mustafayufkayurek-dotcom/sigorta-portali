/** TÜİK 7 coğrafi bölge — il plaka kodları (81 il). */
export type GeographicRegionCode =
  | 'MARMARA'
  | 'EGE'
  | 'AKDENIZ'
  | 'IC_ANADOLU'
  | 'KARADENIZ'
  | 'DOGU_ANADOLU'
  | 'GUNEYDOGU_ANADOLU';

export const GEOGRAPHIC_REGION_LABELS: Record<GeographicRegionCode, string> = {
  MARMARA: 'Marmara',
  EGE: 'Ege',
  AKDENIZ: 'Akdeniz',
  IC_ANADOLU: 'İç Anadolu',
  KARADENIZ: 'Karadeniz',
  DOGU_ANADOLU: 'Doğu Anadolu',
  GUNEYDOGU_ANADOLU: 'Güneydoğu Anadolu',
};

export const GEOGRAPHIC_REGION_PROVINCE_PLATES: Record<GeographicRegionCode, number[]> = {
  MARMARA: [10, 11, 16, 17, 22, 34, 39, 41, 54, 59, 77, 81],
  EGE: [3, 9, 20, 35, 43, 45, 48, 64],
  AKDENIZ: [1, 7, 15, 31, 32, 33, 46, 80],
  IC_ANADOLU: [6, 18, 26, 38, 40, 42, 50, 51, 58, 66, 68, 70, 71],
  KARADENIZ: [5, 8, 14, 19, 28, 29, 37, 52, 53, 55, 57, 60, 61, 67, 69, 74, 78],
  DOGU_ANADOLU: [4, 12, 13, 23, 24, 25, 30, 36, 44, 49, 62, 65, 75, 76],
  GUNEYDOGU_ANADOLU: [2, 21, 27, 47, 56, 63, 72, 73, 79],
};

const PLATE_TO_REGION = new Map<number, GeographicRegionCode>(
  (Object.entries(GEOGRAPHIC_REGION_PROVINCE_PLATES) as [GeographicRegionCode, number[]][])
    .flatMap(([code, plates]) => plates.map((plate) => [plate, code] as const)),
);

export type ProvinceLike = {
  id: string;
  name: string;
  plateCode?: number | string | null;
};

function normalizePlateCode(value?: number | string | null): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getRegionCodeForProvince(
  plateCode?: number | string | null,
  provinceName?: string | null,
  provinces?: ProvinceLike[],
): GeographicRegionCode | null {
  const plate = normalizePlateCode(plateCode);
  if (plate != null) {
    return PLATE_TO_REGION.get(plate) ?? null;
  }
  if (provinceName && provinces?.length) {
    const match = provinces.find((p) => p.name.localeCompare(provinceName, 'tr', { sensitivity: 'base' }) === 0);
    if (match) {
      const resolvedPlate = normalizePlateCode(match.plateCode);
      if (resolvedPlate != null) return PLATE_TO_REGION.get(resolvedPlate) ?? null;
    }
  }
  return null;
}

export function getRegionNameForProvince(
  plateCode?: number | string | null,
  provinceName?: string | null,
  provinces?: ProvinceLike[],
): string | null {
  const code = getRegionCodeForProvince(plateCode, provinceName, provinces);
  return code ? GEOGRAPHIC_REGION_LABELS[code] : null;
}

export function getProvincesForRegionCode<T extends ProvinceLike>(
  code: GeographicRegionCode,
  provinces: T[],
): T[] {
  const plates = new Set(GEOGRAPHIC_REGION_PROVINCE_PLATES[code]);
  return provinces.filter((p) => {
    const plate = normalizePlateCode(p.plateCode);
    return plate != null && plates.has(plate);
  });
}

export function getRegionCodeFromApiCode(apiCode?: string | null): GeographicRegionCode | null {
  const normalized = String(apiCode ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized in GEOGRAPHIC_REGION_PROVINCE_PLATES) {
    return normalized as GeographicRegionCode;
  }
  return null;
}

export function inferSelectedRegionIdsFromServiceAreas(
  provinces: ProvinceLike[],
  serviceAreas: Array<{ provinceId: string; districtId?: string | null }>,
  regions: Array<{ id: string; code: string }>,
): string[] {
  if (serviceAreas.length === 0) return [];

  return regions.filter((region) => {
    const regionCode = getRegionCodeFromApiCode(region.code);
    if (!regionCode) return false;
    const regionProvinces = getProvincesForRegionCode(regionCode, provinces);
    if (regionProvinces.length === 0) return false;
    return regionProvinces.every((province) =>
      serviceAreas.some((area) => area.provinceId === province.id && !area.districtId),
    );
  }).map((region) => region.id);
}

export function getRegionNamesForSelectedIds(
  selectedRegionIds: string[],
  regions: Array<{ id: string; code: string; name?: string }>,
): string[] {
  return selectedRegionIds
    .map((id) => regions.find((r) => r.id === id))
    .filter(Boolean)
    .map((region) => {
      const code = getRegionCodeFromApiCode(region!.code);
      return code ? GEOGRAPHIC_REGION_LABELS[code] : region!.name ?? region!.code;
    });
}
