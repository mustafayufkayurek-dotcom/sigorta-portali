import { Prisma } from '@prisma/client';

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
  prisma: { province: { findFirst: (...args: any[]) => any }; district: { findFirst: (...args: any[]) => any } },
  city?: string | null,
  district?: string | null,
): Promise<{ provinceId: string | null; districtId: string | null }> {
  const cityNorm = normalizeLocationLabel(city);
  if (!cityNorm) return { provinceId: null, districtId: null };
  const province = await prisma.province.findFirst({
    where: { name: { equals: cityNorm, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!province) return { provinceId: null, districtId: null };

  const districtNorm = normalizeLocationLabel(district);
  let districtId: string | null = null;
  if (districtNorm) {
    const districtRecord = await prisma.district.findFirst({
      where: {
        provinceId: province.id,
        name: { equals: districtNorm, mode: 'insensitive' },
      },
      select: { id: true },
    });
    districtId = districtRecord?.id ?? null;
  }

  return { provinceId: province.id, districtId };
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

  // Bölge çözülemedi: aktif (ve amaç filtreli) tüm tedarikçiler — operasyon atayabilsin
  if (!params.provinceId) {
    if (city) {
      base.OR = [
        { city: { equals: city, mode: 'insensitive' } },
        ...(districtName
          ? [{ district: { equals: districtName, mode: 'insensitive' as const } }]
          : []),
      ];
    }
    return base;
  }

  const areaMatch = buildVendorServiceAreaWhere(params.provinceId, params.districtId);
  const locationOr: Prisma.VendorWhereInput[] = [{ serviceAreas: { some: areaMatch } }];

  if (city) {
    if (params.purpose === 'inspector') {
      // Tespitçi havuzu dar: aynı il yeterli; ilçe zorunlu değil.
      locationOr.push({ city: { equals: city, mode: 'insensitive' } });
      if (districtName) {
        locationOr.push({ district: { equals: districtName, mode: 'insensitive' } });
      }
    } else {
      locationOr.push({
        AND: [
          { city: { equals: city, mode: 'insensitive' as const } },
          ...(districtName
            ? [{ district: { equals: districtName, mode: 'insensitive' as const } }]
            : []),
        ],
      });
    }
  }

  base.OR = locationOr;
  return base;
}

/** Bölge eşleşmesi boşsa tespitçi atamasını kilitlememek için ulusal havuz. */
export function buildInspectorFallbackWhere(): Prisma.VendorWhereInput {
  return { status: 'active', canActAsInspector: true };
}
