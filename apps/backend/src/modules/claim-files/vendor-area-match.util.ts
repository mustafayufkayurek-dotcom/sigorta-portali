import { Prisma } from '@prisma/client';
import {
  locationNameVariants,
  matchNamedLocation,
  provinceSearchNames,
  splitCombinedLocation,
} from '../../common/helpers/turkey-location-normalize';

export type VendorNearbyPurpose = 'supplier' | 'inspector';

/** DB / UI placeholder — gerçek il değil; bölge filtresinde yok sayılır. */
const UNRESOLVED_LOCATION_LABELS = new Set([
  'belirtilmemiş',
  'belirtilmemis',
  'belirtilmedi',
  'unknown',
  '-',
]);

export function isUnresolvedLocationLabel(value?: string | null): boolean {
  const t = value?.trim();
  if (!t) return true;
  return UNRESOLVED_LOCATION_LABELS.has(t.toLocaleLowerCase('tr-TR'));
}

export function normalizeLocationLabel(value?: string | null): string | null {
  const t = value?.trim();
  if (!t || isUnresolvedLocationLabel(t)) return null;
  return t;
}

export async function resolveProvinceDistrictIds(
  prisma: {
    province: { findFirst: (...args: any[]) => any; findMany: (...args: any[]) => any };
    district: { findFirst: (...args: any[]) => any; findMany: (...args: any[]) => any };
  },
  city?: string | null,
  district?: string | null,
): Promise<{
  provinceId: string | null;
  districtId: string | null;
  provinceName: string | null;
  districtName: string | null;
}> {
  const empty = { provinceId: null, districtId: null, provinceName: null, districtName: null };
  const cityNorm = normalizeLocationLabel(city);
  if (!cityNorm) return empty;

  const provinces: Array<{ id: string; name: string }> = await prisma.province.findMany({
    select: { id: true, name: true },
  });
  const split = splitCombinedLocation(cityNorm, provinces.map((row) => row.name));
  const districtNorm = normalizeLocationLabel(district) ?? normalizeLocationLabel(split.district);
  let province = matchNamedLocation(split.city, provinces);

  if (!province) {
    const districts: Array<{
      id: string;
      name: string;
      provinceId: string;
      province?: { name: string } | null;
    }> = await prisma.district.findMany({
      select: { id: true, name: true, provinceId: true, province: { select: { name: true } } },
    });
    const districtHits = districts.filter(
      (row) => matchNamedLocation(split.city, [{ name: row.name }]) != null,
    );
    const uniqueProvinceIds = [...new Set(districtHits.map((row) => row.provinceId))];
    if (uniqueProvinceIds.length === 1) {
      const hit = districtHits[0];
      const parent = provinces.find((row) => row.id === hit.provinceId) ?? null;
      return {
        provinceId: hit.provinceId,
        districtId: matchNamedLocation(districtNorm ?? split.city, districtHits)?.id ?? hit.id,
        provinceName: parent?.name ?? hit.province?.name ?? null,
        districtName: matchNamedLocation(districtNorm ?? split.city, districtHits)?.name ?? hit.name,
      };
    }
    return empty;
  }

  let districtId: string | null = null;
  let districtName: string | null = null;
  if (districtNorm) {
    const districtRows: Array<{ id: string; name: string }> = await prisma.district.findMany({
      where: { provinceId: province.id },
      select: { id: true, name: true },
    });
    const included = districtRows.filter((row) =>
      row.name.toLocaleLowerCase('tr-TR').includes(districtNorm.toLocaleLowerCase('tr-TR')),
    );
    const districtRecord =
      matchNamedLocation(districtNorm, districtRows)
      ?? (included.length === 1 ? included[0] : null);
    districtId = districtRecord?.id ?? null;
    districtName = districtRecord?.name ?? null;
  }

  return {
    provinceId: province.id,
    districtId,
    provinceName: province.name,
    districtName,
  };
}

export function buildVendorServiceAreaWhere(
  provinceId: string,
  districtId: string | null,
): Prisma.VendorServiceAreaWhereInput {
  if (districtId) {
    return {
      OR: [{ districtId }, { districtId: null }],
      provinceId,
    };
  }
  // İl biliniyor, ilçe yok: o ildeki tüm hizmet bölgeleri (ilçe kısıtlı + il geneli)
  return { provinceId };
}

export function buildVendorNearbyWhere(params: {
  provinceId: string | null;
  districtId: string | null;
  city?: string | null;
  districtName?: string | null;
  purpose: VendorNearbyPurpose;
}): Prisma.VendorWhereInput {
  const base: Prisma.VendorWhereInput = { status: 'active' };
  const city = normalizeLocationLabel(params.city);
  const districtName = normalizeLocationLabel(params.districtName);

  if (params.purpose === 'inspector') {
    base.canActAsInspector = true;
  }

  // Bölge id çözülemedi: il/ilçe metni + hizmet bölgesi adı (Afyon, Kartepe). Ulusal kesit değil.
  if (!params.provinceId) {
    if (city) {
      const cityNames = locationNameVariants(city);
      const districtNames = locationNameVariants(districtName);
      const nameEquals = (value: string) => ({ equals: value, mode: 'insensitive' as const });
      base.OR = [
        ...cityNames.map((name) => ({ city: nameEquals(name) })),
        ...cityNames.map((name) => ({ district: nameEquals(name) })),
        ...cityNames.map((name) => ({
          serviceAreas: { some: { province: { name: nameEquals(name) } } },
        })),
        ...cityNames.map((name) => ({
          serviceAreas: { some: { district: { name: nameEquals(name) } } },
        })),
        ...districtNames.map((name) => ({ district: nameEquals(name) })),
        ...districtNames.map((name) => ({
          serviceAreas: { some: { district: { name: nameEquals(name) } } },
        })),
      ];
    }
    return base;
  }

  const areaMatch = buildVendorServiceAreaWhere(params.provinceId, params.districtId);
  const locationOr: Prisma.VendorWhereInput[] = [{ serviceAreas: { some: areaMatch } }];

  if (city) {
    // Aynı il yeterli; ilçe zorunlu değil — uzak/seyrek ilçelerde (örn. Başkale) havuzu kilitleme.
    for (const name of provinceSearchNames(city)) {
      locationOr.push({ city: { equals: name, mode: 'insensitive' } });
    }
    if (districtName) {
      locationOr.push({ district: { equals: districtName, mode: 'insensitive' } });
    }
  }

  base.OR = locationOr;
  return base;
}

/** Bölge eşleşmesi boşsa tespitçi atamasını kilitlememek için ulusal havuz. */
export function buildInspectorFallbackWhere(): Prisma.VendorWhereInput {
  return { status: 'active', canActAsInspector: true };
}

/**
 * Bölge eşleşmesi boşsa tedarikçi atamasını kilitlememek için ulusal havuz.
 * categoryFilter zorunlu tutulmalı: acil → ['acil','her_ikisi'], hasar → ['hasar','her_ikisi']
 * null/boş = kategori filtresi yok (yalnızca bilinçli çağrılarda).
 */
export function buildSupplierFallbackWhere(
  categoryFilter?: string[] | null,
): Prisma.VendorWhereInput {
  const base: Prisma.VendorWhereInput = { status: 'active' };
  if (categoryFilter?.length) {
    base.category = { in: categoryFilter };
  }
  return base;
}
