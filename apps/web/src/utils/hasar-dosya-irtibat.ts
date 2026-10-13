function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function hasarTelefonGosterim(raw: string): string {
  const d = phoneDigits(raw).replace(/^0+/, '');
  if (!d) return '';
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return raw.trim();
}

function hasarTelHref(raw: string): string {
  let d = phoneDigits(raw);
  if (!d) return '';
  if (d.startsWith('90') && d.length >= 12) return `tel:+${d}`;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10) return `tel:+90${d}`;
  return `tel:${d}`;
}

/** Yeni Dosya’da girilen irtibat adı — dosya sorumlusu ekranında durur. */
export function hasarIrtibatAdi(claim: { siteContactName?: string | null } | null | undefined): string {
  return asTrimmed(claim?.siteContactName);
}

export function hasarIrtibatTelefonGosterim(
  claim: { siteContactPhone?: string | null } | null | undefined,
): string {
  const raw = asTrimmed(claim?.siteContactPhone);
  return raw ? hasarTelefonGosterim(raw) : '';
}

export function hasarIrtibatTelHref(
  claim: { siteContactPhone?: string | null } | null | undefined,
): string {
  return hasarTelHref(asTrimmed(claim?.siteContactPhone));
}

export function hasarSigortaliTelefonGosterim(phone: string | null | undefined): string {
  const raw = asTrimmed(phone);
  return raw ? hasarTelefonGosterim(raw) : '';
}

export function hasarSigortaliTelHref(phone: string | null | undefined): string {
  return hasarTelHref(asTrimmed(phone));
}
