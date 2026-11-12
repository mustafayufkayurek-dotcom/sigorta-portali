import { readOpenAddressPlace, type OpenAddressPlace } from '@sigorta/shared';
import { districts, provinces } from '@/data/turkey-locations';

const catalog = provinces.map((province) => ({
  plateCode: province.plateCode,
  name: province.name,
  districts: districts[province.code] ?? [],
}));

export function readClaimAddressPlace(
  openAddress: string,
  city?: string | null,
  district?: string | null,
): OpenAddressPlace {
  return readOpenAddressPlace(openAddress, catalog, { city, district });
}

export function applyClaimAddressPlace(openAddress: string): OpenAddressPlace {
  return readOpenAddressPlace(openAddress, catalog, { city: '', district: '' });
}
