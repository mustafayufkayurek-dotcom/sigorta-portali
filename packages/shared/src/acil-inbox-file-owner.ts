function foldPersonName(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/** Deneme hesabı dosya sorumlusu olarak basılmaz. */
export function isPlaceholderOfficeUserName(name: string | null | undefined): boolean {
  const folded = foldPersonName(name);
  if (!folded) return false;
  if (folded === 'test kullanıcı' || folded === 'test kullanici') return true;
  return /^test\s+kullan/.test(folded);
}

export function isPlaceholderOfficeUser(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): boolean {
  const name = `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim();
  if (isPlaceholderOfficeUserName(name)) return true;
  const email = (input.email ?? '').trim().toLowerCase();
  return email.endsWith('@example.com');
}

function personNamesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = foldPersonName(left);
  const b = foldPersonName(right);
  if (!a || !b) return false;
  if (a === '—' || b === '—' || a === 'belirtilmemiş' || b === 'belirtilmemiş') return false;
  return a === b;
}

/**
 * Gelen kutudan Acil dosya açılırken Kimde = işlemi yapan ofis kullanıcısı.
 * Sigortalı adı ve Test Kullanıcı sessizce yazılmaz.
 * Başka gerçek personel açık seçildiyse o kalır.
 */
export function resolveAcilInboxFileOwnerId(input: {
  actorUserId: string;
  explicitUserId?: string | null;
  explicitUserName?: string | null;
  insuredName?: string | null;
}): string {
  const actor = input.actorUserId.trim();
  const explicit = input.explicitUserId?.trim() || '';
  if (!explicit) return actor;
  if (explicit === actor) return explicit;
  if (personNamesEqual(input.explicitUserName, input.insuredName)) return actor;
  if (isPlaceholderOfficeUserName(input.explicitUserName)) return actor;
  return explicit;
}
