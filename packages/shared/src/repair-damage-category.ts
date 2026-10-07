export type RepairDamageCategoryOption = {
  code: string;
  name: string;
  status?: string;
};

export const DEFAULT_REPAIR_DAMAGE_CATEGORIES: RepairDamageCategoryOption[] = [
  { code: 'bina', name: 'Bina' },
  { code: 'esya', name: 'Eşya' },
  { code: 'mm', name: 'Mali Mesuliyet' },
];

export function normalizeRepairDamageCategoryCode(raw: string | null | undefined): string {
  const code = (raw ?? 'bina').trim().toLowerCase().replace(/\s+/g, '_');
  return code || 'bina';
}

/** Raporda kısa kod (MM) görünür; Bina / Eşya adıyla kalır. */
export function repairDamageCategorySelectLabel(cat: { code: string; name: string }): string {
  const code = cat.code.trim();
  if (code.length > 0 && code.length <= 3) return code.toLocaleUpperCase('tr-TR');
  return cat.name;
}

/** Ayarlar tam ad yazar; MM yalnızca raporda kısaltmadır. */
export function repairDamageCategorySettingsLabel(cat: { code: string; name: string }): string {
  const name = cat.name.trim();
  return name || repairDamageCategorySelectLabel(cat);
}

export function repairDamageCategoryDisplay(
  raw: string | null | undefined,
  cats: Array<{ code: string; name: string }>,
): string {
  const code = normalizeRepairDamageCategoryCode(raw);
  const found = cats.find((c) => normalizeRepairDamageCategoryCode(c.code) === code);
  if (found) return repairDamageCategorySelectLabel(found);
  if (code === 'esya') return 'Eşya';
  if (code === 'mm') return 'MM';
  if (code === 'demirbas') return 'Demirbaş';
  return 'Bina';
}

export function mergeRepairDamageCategories(
  fromApi: RepairDamageCategoryOption[] | null | undefined,
): RepairDamageCategoryOption[] {
  const active = (fromApi ?? []).filter((c) => !c.status || c.status === 'active');
  if (active.length === 0) {
    return DEFAULT_REPAIR_DAMAGE_CATEGORIES.map((c) => ({ ...c }));
  }
  return active.map((c) => ({
    code: normalizeRepairDamageCategoryCode(c.code),
    name: c.name,
  }));
}

export type RepairMahalCatalogEntry = {
  categoryCode: string;
  label: string;
};

/** Raporda kategori seçilince yalnız o kategorinin mahalleri önerilir. */
export function mahalSuggestionsForCategory(
  catalog: RepairMahalCatalogEntry[] | null | undefined,
  categoryCode: string,
  extraLabels: string[] = [],
): string[] {
  const code = normalizeRepairDamageCategoryCode(categoryCode);
  const fromCat = (catalog ?? [])
    .filter((row) => normalizeRepairDamageCategoryCode(row.categoryCode) === code)
    .map((row) => row.label.trim())
    .filter(Boolean);
  const extra = extraLabels.map((label) => label.trim()).filter(Boolean);
  return Array.from(new Set([...fromCat, ...extra]));
}
