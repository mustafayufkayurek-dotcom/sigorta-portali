export function normalizeInsuranceCatalogName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\ba\.?\s*ş\.?/gi, ' ')
    .replace(/\ba\.?\s*s\.?/gi, ' ')
    .replace(/\banonim\s*şirketi\b/gi, ' ')
    .replace(/['.`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function insuranceCatalogNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeInsuranceCatalogName(a);
  const nb = normalizeInsuranceCatalogName(b);
  return Boolean(na && nb && na === nb);
}

/** Karttaki unvan/vergi, Ayarlar kaydıyla tek ve net eşleşirse id döner. Tahmin yığını yok. */
export function matchInsuranceCatalogCompany(
  companies: Array<{ id: string; name: string; taxNumber?: string | null }>,
  card: { taxNumber?: string | null; companyName?: string | null; shortName?: string | null },
): { id: string; name: string } | null {
  const tax = String(card.taxNumber ?? '').replace(/\D/g, '');
  if (tax.length >= 10) {
    const byTax = companies.filter(
      (row) => String(row.taxNumber ?? '').replace(/\D/g, '') === tax,
    );
    if (byTax.length === 1) return { id: byTax[0]!.id, name: byTax[0]!.name };
  }
  const names = [card.companyName, card.shortName].filter(Boolean);
  const exact = companies.filter((row) =>
    names.some((name) => insuranceCatalogNamesMatch(name, row.name)),
  );
  if (exact.length === 1) return { id: exact[0]!.id, name: exact[0]!.name };
  return null;
}
