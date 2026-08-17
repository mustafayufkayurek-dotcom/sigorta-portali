/** Ayarlar → Müşteri Grupları listesinden Müşteriler'e ekleme akışı */

export type MusteriGrubuAddContext = {
  returnTo: string;
  returnLabel: string;
  subType: string;
};

export function buildMusteriGrubuAddHref(input: {
  subType: string;
  returnTo: string;
  returnLabel: string;
}): string {
  const params = new URLSearchParams({
    openAdd: '1',
    subType: input.subType,
    entityType: 'corporate',
    returnTo: input.returnTo,
    returnLabel: input.returnLabel,
  });
  return `/panel/musteriler?${params.toString()}`;
}

export function parseMusteriGrubuAddContext(
  params: URLSearchParams,
): MusteriGrubuAddContext | null {
  const returnTo = params.get('returnTo')?.trim();
  const returnLabel = params.get('returnLabel')?.trim();
  const subType = params.get('subType')?.trim();
  if (!returnTo || !returnLabel || !subType) return null;
  if (!returnTo.startsWith('/panel/')) return null;
  return { returnTo, returnLabel, subType };
}
