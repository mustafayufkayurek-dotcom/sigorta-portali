export type RelationshipUsageArea =
  | 'musteri'
  | 'eksper'
  | 'sigorta_sirketi'
  | 'asistan_firmasi'
  | 'private_customer'
  | 'tedarikci'
  | 'acil'
  | 'hasar'
  | 'dosya';

export type RelationshipTypeRow = {
  label: string;
  active?: boolean;
  usageAreas?: string[] | null;
};

/** Müşteri kartının altı — eksper ayrı form değildir. */
export const RELATIONSHIP_CUSTOMER_CHILDREN = [
  { value: 'eksper' as const, label: 'Eksper' },
  { value: 'sigorta_sirketi' as const, label: 'Sigorta Şirketi' },
  { value: 'asistan_firmasi' as const, label: 'Asistans Firma' },
  { value: 'private_customer' as const, label: 'Özel Müşteri' },
];

const CUSTOMER_CHILD_VALUES = new Set<string>(RELATIONSHIP_CUSTOMER_CHILDREN.map((row) => row.value));

/** Tedarikçi kartının altı — Acil ve Hasar ayrı form değildir. */
export const RELATIONSHIP_VENDOR_CHILDREN = [
  { value: 'acil' as const, label: 'Acil Yardım' },
  { value: 'hasar' as const, label: 'Hasar Onarım' },
];

const VENDOR_CHILD_VALUES = new Set<string>(RELATIONSHIP_VENDOR_CHILDREN.map((row) => row.value));

export function isRelationshipCustomerChild(area?: string | null): boolean {
  return CUSTOMER_CHILD_VALUES.has(String(area ?? '').trim());
}

export function isRelationshipVendorChild(area?: string | null): boolean {
  return VENDOR_CHILD_VALUES.has(String(area ?? '').trim());
}

export function relationshipUsageAreaForCustomerSubType(
  subType: string | null | undefined,
): RelationshipUsageArea {
  const value = (subType ?? '').trim();
  if (value === 'eksper' || value === 'eksper_firmasi') return 'eksper';
  if (value === 'sigorta_sirketi') return 'sigorta_sirketi';
  if (value === 'asistan_firmasi' || value === 'asistans_firmasi') return 'asistan_firmasi';
  if (value === 'private_customer') return 'private_customer';
  return 'musteri';
}

export function isRelationshipCustomerParentOn(areas: string[] | null | undefined): boolean {
  const list = areas ?? [];
  return list.includes('musteri') || list.some((area) => isRelationshipCustomerChild(area));
}

export function isRelationshipVendorParentOn(areas: string[] | null | undefined): boolean {
  const list = areas ?? [];
  return list.includes('tedarikci') || list.some((area) => isRelationshipVendorChild(area));
}

export function relationshipTypeAppliesToArea(
  row: RelationshipTypeRow,
  area: RelationshipUsageArea,
): boolean {
  if (area === 'dosya') return false;
  const areas = (row.usageAreas ?? []).filter((item) => item !== 'dosya');
  if (areas.includes(area)) return true;
  if (area === 'tedarikci') return isRelationshipVendorParentOn(areas);
  if (isRelationshipVendorChild(area)) {
    const hasChild = areas.some((item) => isRelationshipVendorChild(item));
    return !hasChild && areas.includes('tedarikci');
  }
  const hasChild = areas.some((item) => isRelationshipCustomerChild(item));
  return !hasChild && areas.includes('musteri');
}

export function relationshipTypeLabelsForVendorCategory(
  types: RelationshipTypeRow[],
  category: string | null | undefined,
): string[] {
  const value = String(category ?? '').trim();
  if (value === 'her_ikisi') {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const row of types) {
      if (row.active === false) continue;
      if (
        relationshipTypeAppliesToArea(row, 'acil')
        || relationshipTypeAppliesToArea(row, 'hasar')
      ) {
        if (!seen.has(row.label)) {
          seen.add(row.label);
          labels.push(row.label);
        }
      }
    }
    return labels;
  }
  const area: RelationshipUsageArea = value === 'acil' ? 'acil' : 'hasar';
  return relationshipTypeLabelsForArea(types, area);
}

export function relationshipTypeLabelsForArea(
  types: RelationshipTypeRow[],
  area: RelationshipUsageArea,
): string[] {
  return types
    .filter((row) => row.active !== false && relationshipTypeAppliesToArea(row, area))
    .map((row) => row.label);
}

export function relationshipUsageDisplayLabels(areas: string[] | null | undefined): string[] {
  const list = areas ?? [];
  const labels: string[] = [];
  if (isRelationshipCustomerParentOn(list)) {
    const children = RELATIONSHIP_CUSTOMER_CHILDREN.filter((row) => list.includes(row.value));
    if (children.length === 0) labels.push('Müşteri');
    else children.forEach((row) => labels.push(`Müşteri · ${row.label}`));
  }
  if (isRelationshipVendorParentOn(list)) {
    const children = RELATIONSHIP_VENDOR_CHILDREN.filter((row) => list.includes(row.value));
    if (children.length === 0) labels.push('Tedarikçi');
    else children.forEach((row) => labels.push(`Tedarikçi · ${row.label}`));
  }
  return labels;
}

export function toggleRelationshipUsageParent(
  prev: string[],
  parent: 'musteri' | 'tedarikci',
): string[] {
  const current = prev.filter((area) => area !== 'dosya');
  if (parent === 'tedarikci') {
    if (isRelationshipVendorParentOn(current)) {
      return current.filter((area) => area !== 'tedarikci' && !isRelationshipVendorChild(area));
    }
    return [...current, 'tedarikci'];
  }
  if (isRelationshipCustomerParentOn(current)) {
    return current.filter((area) => area !== 'musteri' && !isRelationshipCustomerChild(area));
  }
  return [...current, 'musteri'];
}

export function toggleRelationshipCustomerChild(prev: string[], child: string): string[] {
  if (!isRelationshipCustomerChild(child)) return prev.filter((area) => area !== 'dosya');
  const current = prev.filter((area) => area !== 'dosya');
  const has = current.includes(child);
  let next = has
    ? current.filter((area) => area !== child)
    : [...current.filter((area) => area !== 'musteri'), child];
  const anyChild = next.some((area) => isRelationshipCustomerChild(area));
  if (anyChild) {
    next = next.filter((area) => area !== 'musteri');
  } else {
    next = [...next.filter((area) => !isRelationshipCustomerChild(area)), 'musteri'];
  }
  return next;
}

export function toggleRelationshipVendorChild(prev: string[], child: string): string[] {
  if (!isRelationshipVendorChild(child)) return prev.filter((area) => area !== 'dosya');
  const current = prev.filter((area) => area !== 'dosya');
  const has = current.includes(child);
  let next = has
    ? current.filter((area) => area !== child)
    : [...current.filter((area) => area !== 'tedarikci'), child];
  const anyChild = next.some((area) => isRelationshipVendorChild(area));
  if (anyChild) {
    next = next.filter((area) => area !== 'tedarikci');
  } else {
    next = [...next.filter((area) => !isRelationshipVendorChild(area)), 'tedarikci'];
  }
  return next;
}

export function ensureRelationshipVendorUsage(
  prev: string[] | null | undefined,
  category: string | null | undefined,
): string[] {
  const current = (prev ?? []).filter((area) => area !== 'dosya');
  const value = String(category ?? '').trim();
  if (value === 'her_ikisi') {
    if (isRelationshipVendorParentOn(current) && !current.some((area) => isRelationshipVendorChild(area))) {
      return current;
    }
    const next = current.filter((area) => area !== 'tedarikci');
    for (const child of ['acil', 'hasar'] as const) {
      if (!next.includes(child)) next.push(child);
    }
    return next;
  }
  const child = value === 'acil' ? 'acil' : 'hasar';
  if (relationshipTypeAppliesToArea({ label: '', usageAreas: current }, child)) return current;
  return [...current.filter((area) => area !== 'tedarikci'), child];
}
