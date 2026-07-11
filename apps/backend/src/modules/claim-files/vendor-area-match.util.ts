import { Prisma } from '@prisma/client';

export type VendorNearbyPurpose = 'supplier' | 'inspector';

export async function resolveProvinceDistrictIds(
  prisma: { province: { findFirst: (...args: any[]) => any }; district: { findFirst: (...args: any[]) => any } },
  city?: string | null,
  district?: string | null,
): Promise<{ provinceId: string | null; districtId: string | null }> {
  if (!city?.trim()) return { provinceId: null, districtId: null };
  const province = await prisma.province.findFirst({
    where: { name: { equals: city.trim(), mode: 'insensitive' } },
    select: { id: true },
  });
  if (!province) return { provinceId: null, districtId: null };

  let districtId: string | null = null;
  if (district?.trim()) {
    const districtRecord = await prisma.district.findFirst({
      where: {
        provinceId: province.id,
        name: { equals: district.trim(), mode: 'insensitive' },
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
  return { provinceId, districtId: null };
}

export function buildVendorNearbyWhere(params: {
  provinceId: string | null;
  districtId: string | null;
  city?: string | null;
  districtName?: string | null;
  purpose: VendorNearbyPurpose;
}): Prisma.VendorWhereInput {
  const base: Prisma.VendorWhereInput = { status: 'active' };

  if (params.purpose === 'inspector') {
    base.canActAsInspector = true;
  }

  if (!params.provinceId) {
    if (params.city?.trim()) {
      base.OR = [
        { city: { equals: params.city.trim(), mode: 'insensitive' } },
        ...(params.districtName?.trim()
          ? [{ district: { equals: params.districtName.trim(), mode: 'insensitive' as const } }]
          : []),
      ];
    }
    return base;
  }

  const areaMatch = buildVendorServiceAreaWhere(params.provinceId, params.districtId);
  base.OR = [
    { serviceAreas: { some: areaMatch } },
    ...(params.city?.trim()
      ? [{
          AND: [
            { city: { equals: params.city.trim(), mode: 'insensitive' as const } },
            ...(params.districtName?.trim()
              ? [{ district: { equals: params.districtName.trim(), mode: 'insensitive' as const } }]
              : []),
          ],
        }]
      : []),
  ];

  return base;
}
