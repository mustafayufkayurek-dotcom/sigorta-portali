/** TÜİK 7 coğrafi bölge — il plaka kodları (81 il). Backend routing ile paylaşılır. */
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

/** İl adı → plaka (API plateCode yoksa statik eşleme). */
const PROVINCE_NAME_TO_PLATE: Record<string, number> = {
  Adana: 1, Adıyaman: 2, Afyonkarahisar: 3, Ağrı: 4, Amasya: 5, Ankara: 6, Antalya: 7, Artvin: 8,
  Aydın: 9, Balıkesir: 10, Bilecik: 11, Bingöl: 12, Bitlis: 13, Bolu: 14, Burdur: 15, Bursa: 16,
  Çanakkale: 17, Çankırı: 18, Çorum: 19, Denizli: 20, Diyarbakır: 21, Edirne: 22, Elazığ: 23,
  Erzincan: 24, Erzurum: 25, Eskişehir: 26, Gaziantep: 27, Giresun: 28, Gümüşhane: 29, Hakkari: 30,
  Hatay: 31, Isparta: 32, Mersin: 33, İstanbul: 34, İzmir: 35, Kars: 36, Kastamonu: 37, Kayseri: 38,
  Kırklareli: 39, Kırşehir: 40, Kocaeli: 41, Konya: 42, Kütahya: 43, Malatya: 44, Manisa: 45,
  Kahramanmaraş: 46, Mardin: 47, Muğla: 48, Muş: 49, Nevşehir: 50, Niğde: 51, Ordu: 52, Rize: 53,
  Sakarya: 54, Samsun: 55, Siirt: 56, Sinop: 57, Sivas: 58, Tekirdağ: 59, Tokat: 60, Trabzon: 61,
  Tunceli: 62, Şanlıurfa: 63, Uşak: 64, Van: 65, Yozgat: 66, Zonguldak: 67, Aksaray: 68, Bayburt: 69,
  Karaman: 70, Kırıkkale: 71, Batman: 72, Şırnak: 73, Bartın: 74, Ardahan: 75, Iğdır: 76, Yalova: 77,
  Karabük: 78, Kilis: 79, Osmaniye: 80, Düzce: 81,
};

function normalizeTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr');
}

function resolvePlateFromProvinceName(provinceName?: string | null): number | null {
  if (!provinceName) return null;
  const trimmed = provinceName.trim();
  if (PROVINCE_NAME_TO_PLATE[trimmed] != null) return PROVINCE_NAME_TO_PLATE[trimmed];
  const normalizedTarget = normalizeTr(trimmed);
  for (const [name, plate] of Object.entries(PROVINCE_NAME_TO_PLATE)) {
    if (normalizeTr(name) === normalizedTarget) return plate;
  }
  return null;
}

export function getRegionCodeForProvinceName(provinceName?: string | null): GeographicRegionCode | null {
  const plate = resolvePlateFromProvinceName(provinceName);
  if (plate == null) return null;
  return PLATE_TO_REGION.get(plate) ?? null;
}

export function getRegionNameForProvinceName(provinceName?: string | null): string | null {
  const code = getRegionCodeForProvinceName(provinceName);
  return code ? GEOGRAPHIC_REGION_LABELS[code] : null;
}

export function regionValueMatchesProvince(regionValues: string[], provinceName?: string | null): boolean {
  if (!provinceName || regionValues.length === 0) return false;
  const regionName = getRegionNameForProvinceName(provinceName);
  const regionCode = getRegionCodeForProvinceName(provinceName);
  if (!regionName) return false;
  const normalizedProvinceRegion = normalizeTr(regionName);
  return regionValues.some((value) => {
    const normalized = normalizeTr(String(value ?? ''));
    if (normalized === normalizedProvinceRegion) return true;
    if (regionCode && normalized === normalizeTr(regionCode)) return true;
    if (regionCode && normalized === normalizeTr(GEOGRAPHIC_REGION_LABELS[regionCode])) return true;
    return false;
  });
}
