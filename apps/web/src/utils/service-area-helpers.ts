export type ServiceAreaInput = {
  provinceId: string;
  districtId?: string | null;
  provinceName?: string | null;
  districtName?: string | null;
};

export type ServiceAreaLike = {
  provinceId: string;
  districtId: string | null;
  provinceName?: string | null;
  districtName?: string | null;
};

function normalizeArea(sa: ServiceAreaInput): ServiceAreaLike {
  return {
    provinceId: sa.provinceId,
    districtId: sa.districtId ?? null,
    provinceName: sa.provinceName,
    districtName: sa.districtName,
  };
}

/** İlçe seçili mi — tek tek kayıt veya "tüm il" (districtId: null) kapsamı */
export function isDistrictAreaChecked(
  areas: ServiceAreaInput[],
  provinceId: string,
  districtId: string,
): boolean {
  if (areas.some((sa) => sa.provinceId === provinceId && !sa.districtId)) return true;
  return areas.some((sa) => sa.provinceId === provinceId && sa.districtId === districtId);
}

/** Seçili ilin tüm ilçelerini tek tek ekler (checkbox'lar işaretlenir) */
export function addAllDistrictsInProvince(
  areas: ServiceAreaInput[],
  provinceId: string,
  districts: { id: string; name: string }[],
  provinceName?: string,
): ServiceAreaLike[] {
  const cleaned = areas.filter((sa) => sa.provinceId !== provinceId);
  const entries = districts.map((d) => ({
    provinceId,
    districtId: d.id,
    provinceName,
    districtName: d.name,
  }));
  return [...cleaned.map(normalizeArea), ...entries];
}

/** İlin tamamını tek kayıt olarak ekler (districtId: null — "Tüm İl") */
export function addWholeProvinceEntry(
  areas: ServiceAreaInput[],
  provinceId: string,
  provinceName?: string,
): ServiceAreaLike[] {
  return [
    ...areas.filter((sa) => sa.provinceId !== provinceId).map(normalizeArea),
    { provinceId, districtId: null, provinceName },
  ];
}

/** Tek ilçe seçimini aç/kapa; "tüm il" kaydı varsa genişlet/daralt */
export function toggleDistrictArea(
  areas: ServiceAreaInput[],
  provinceId: string,
  districtId: string,
  districtsInProvince: { id: string; name: string }[],
  provinceName?: string,
): ServiceAreaLike[] {
  const checked = isDistrictAreaChecked(areas, provinceId, districtId);
  const hasWhole = areas.some((sa) => sa.provinceId === provinceId && !sa.districtId);

  if (checked) {
    if (hasWhole) {
      const otherAreas = areas.filter((sa) => sa.provinceId !== provinceId);
      return [
        ...otherAreas.map(normalizeArea),
        ...districtsInProvince
          .filter((d) => d.id !== districtId)
          .map((d) => ({ provinceId, districtId: d.id, provinceName, districtName: d.name })),
      ];
    }
    return areas
      .filter((sa) => !(sa.provinceId === provinceId && sa.districtId === districtId))
      .map(normalizeArea);
  }

  const districtName = districtsInProvince.find((d) => d.id === districtId)?.name;
  const withoutWhole = areas.filter((sa) => !(sa.provinceId === provinceId && !sa.districtId));
  const next: ServiceAreaLike[] = [
    ...withoutWhole.map(normalizeArea),
    { provinceId, districtId, provinceName, districtName: districtName ?? null },
  ];
  const selectedCount = next.filter((sa) => sa.provinceId === provinceId && sa.districtId).length;
  if (districtsInProvince.length > 0 && selectedCount === districtsInProvince.length) {
    return addWholeProvinceEntry(
      next.filter((sa) => sa.provinceId !== provinceId),
      provinceId,
      provinceName,
    );
  }
  return next;
}
