export type RelationshipUsageArea = 'musteri' | 'eksper' | 'tedarikci' | 'dosya';

export type RelationshipTypeRow = {
  label: string;
  active?: boolean;
  usageAreas?: string[] | null;
};

/** Eksper kartı eksper işaretini okur. Diğer müşteri kartları Müşteri işaretini okur. */
export function relationshipUsageAreaForCustomerSubType(
  subType: string | null | undefined,
): RelationshipUsageArea {
  const value = (subType ?? '').trim();
  if (value === 'eksper' || value === 'eksper_firmasi') return 'eksper';
  return 'musteri';
}

export function relationshipTypeLabelsForArea(
  types: RelationshipTypeRow[],
  area: RelationshipUsageArea,
): string[] {
  return types
    .filter((row) => row.active !== false && (row.usageAreas ?? []).includes(area))
    .map((row) => row.label);
}
