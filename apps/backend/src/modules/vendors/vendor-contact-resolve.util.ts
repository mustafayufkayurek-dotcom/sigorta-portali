/** Tedarikçi create/update — kök phone/email ile contacts/contactInfos uyumu */
export function resolveVendorPrimaryPhone(dto: {
  phone?: string | null;
  contacts?: Array<{ phone?: string | null; isPrimary?: boolean }>;
  contactInfos?: Array<{ type?: string; value?: string }>;
}): string | null {
  if (dto.phone?.trim()) return dto.phone.trim();

  const primary = dto.contacts?.find((c) => c.isPrimary && c.phone?.trim());
  if (primary?.phone?.trim()) return primary.phone.trim();

  const anyContact = dto.contacts?.find((c) => c.phone?.trim());
  if (anyContact?.phone?.trim()) return anyContact.phone.trim();

  const info = dto.contactInfos?.find((ci) => ci.type === 'phone' && ci.value?.trim());
  if (info?.value?.trim()) return info.value.trim();

  return null;
}

export function resolveVendorPrimaryEmail(dto: {
  email?: string | null;
  contacts?: Array<{ email?: string | null; isPrimary?: boolean }>;
  contactInfos?: Array<{ type?: string; value?: string }>;
}): string | null {
  if (dto.email?.trim()) return dto.email.trim();

  const primary = dto.contacts?.find((c) => c.isPrimary && c.email?.trim());
  if (primary?.email?.trim()) return primary.email.trim();

  const anyContact = dto.contacts?.find((c) => c.email?.trim());
  if (anyContact?.email?.trim()) return anyContact.email.trim();

  const info = dto.contactInfos?.find((ci) => ci.type === 'email' && ci.value?.trim());
  if (info?.value?.trim()) return info.value.trim();

  return null;
}
