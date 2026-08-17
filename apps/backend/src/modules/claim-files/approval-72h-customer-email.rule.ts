/**
 * 72s onay hatırlatması — müşteri e-postası güvenli derleme kuralları.
 * Yanlış alıcı veya eksik dosya bilgisiyle mail gönderilmez.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Approval72hCustomerEmailSource = {
  fileNo?: string | null;
  insuredName?: string | null;
  customer?: {
    email?: string | null;
    companyName?: string | null;
    shortName?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contacts?: Array<{ email?: string | null; isPrimary?: boolean | null }> | null;
  } | null;
  insuranceCompany?: {
    name?: string | null;
    contactEmail?: string | null;
  } | null;
  propertyAddress?: {
    city?: string | null;
    district?: string | null;
  } | null;
};

export type Approval72hCustomerEmailPayload = {
  recipientEmail: string;
  recipientName: string | null;
  customerName: string;
  insuranceCompanyName: string;
  insuredName: string;
  cityDistrict: string;
  fileNo: string;
};

export type Approval72hCustomerEmailResolveResult =
  | { ok: true; payload: Approval72hCustomerEmailPayload }
  | { ok: false; reason: string };

function trimOrNull(value?: string | null): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || null;
}

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/** Yalnız müşteri kaydı e-postası — sigorta şirketi / personel fallback yok. */
export function resolveCustomerReminderEmail(
  customer: Approval72hCustomerEmailSource['customer'],
): string | null {
  if (!customer) return null;
  const direct = trimOrNull(customer.email);
  if (direct && isValidEmail(direct)) return direct;

  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  const primary = contacts.find((c) => c?.isPrimary && trimOrNull(c.email));
  const primaryEmail = trimOrNull(primary?.email ?? null);
  if (primaryEmail && isValidEmail(primaryEmail)) return primaryEmail;

  for (const c of contacts) {
    const email = trimOrNull(c?.email ?? null);
    if (email && isValidEmail(email)) return email;
  }
  return null;
}

/** Hitap ünvanı — yalnızca müşteri kaydından; sigorta şirketi adı kullanılmaz. */
export function resolveCustomerReminderTitle(
  customer: Approval72hCustomerEmailSource['customer'],
): string | null {
  if (!customer) return null;
  return (
    trimOrNull(customer.companyName)
    || trimOrNull(customer.fullName)
    || trimOrNull(customer.shortName)
    || trimOrNull(`${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim())
  );
}

export function resolveCustomerReminderPersonName(
  customer: Approval72hCustomerEmailSource['customer'],
): string | null {
  if (!customer) return null;
  return (
    trimOrNull(`${customer.contactFirstName ?? ''} ${customer.contactLastName ?? ''}`.trim())
    || trimOrNull(`${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim())
  );
}

export function resolveCityDistrict(
  address: Approval72hCustomerEmailSource['propertyAddress'],
): string | null {
  if (!address) return null;
  const city = trimOrNull(address.city);
  const district = trimOrNull(address.district);
  if (!city && !district) return null;
  if (city && district) return `${city} / ${district}`;
  return city || district;
}

/**
 * Mail göndermeden önce zorunlu alan kapısı.
 * Eksik/yanlış bilgi → gönderim yok.
 */
export function resolveApproval72hCustomerEmailPayload(
  source: Approval72hCustomerEmailSource,
): Approval72hCustomerEmailResolveResult {
  const fileNo = trimOrNull(source.fileNo);
  if (!fileNo) {
    return { ok: false, reason: 'Dosya no yok' };
  }

  if (!source.customer) {
    return { ok: false, reason: 'Müşteri kaydı yok' };
  }

  const recipientEmail = resolveCustomerReminderEmail(source.customer);
  if (!recipientEmail) {
    return { ok: false, reason: 'Müşteri e-postası yok veya geçersiz' };
  }

  const customerName = resolveCustomerReminderTitle(source.customer);
  if (!customerName) {
    return { ok: false, reason: 'Müşteri ünvanı yok' };
  }

  const insuranceCompanyName = trimOrNull(source.insuranceCompany?.name);
  if (!insuranceCompanyName) {
    return { ok: false, reason: 'Sigorta şirketi yok' };
  }

  const insuredName = trimOrNull(source.insuredName);
  if (!insuredName) {
    return { ok: false, reason: 'Sigortalı adı soyadı yok' };
  }

  const cityDistrict = resolveCityDistrict(source.propertyAddress);
  if (!cityDistrict) {
    return { ok: false, reason: 'İl / ilçe yok' };
  }

  // Sigorta şirketi e-postasına düşmeyi engelle (müşteri ≠ sigorta karışıklığı)
  const insuranceEmail = trimOrNull(source.insuranceCompany?.contactEmail);
  if (insuranceEmail && insuranceEmail.toLowerCase() === recipientEmail.toLowerCase()) {
    // Aynı e-posta hem müşteri hem sigorta kaydında olabilir (kurumsal tek adres) — izinli,
    // ancak alıcı kaynağı müşteri kaydı olduğu için sorun değil. Bilinçli no-op.
  }

  return {
    ok: true,
    payload: {
      recipientEmail,
      recipientName: resolveCustomerReminderPersonName(source.customer),
      customerName,
      insuranceCompanyName,
      insuredName,
      cityDistrict,
      fileNo,
    },
  };
}
