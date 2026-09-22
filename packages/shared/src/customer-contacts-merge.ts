/** Müşteri kartı yetkilisi ve Yetkili Kişiler aynı listedir. */

export type CustomerContactWrite = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
};

export type CustomerPrimaryPerson = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
};

function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export function customerContactDisplayName(row: CustomerContactWrite): string {
  const named = String(row.name ?? '').trim();
  if (named) return named.replace(/\s+/g, ' ');
  return `${String(row.firstName ?? '').trim()} ${String(row.lastName ?? '').trim()}`.trim().replace(/\s+/g, ' ');
}

export function mergePrimaryIntoCustomerContacts(
  contacts: CustomerContactWrite[] | null | undefined,
  primary: CustomerPrimaryPerson,
): CustomerContactWrite[] {
  const list = (contacts ?? [])
    .filter((row) => customerContactDisplayName(row))
    .map((row) => ({ ...row, name: customerContactDisplayName(row) }));

  const firstName = String(primary.firstName ?? '').trim();
  const lastName = String(primary.lastName ?? '').trim();
  const primaryName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
  if (!primaryName) {
    return list.map((row, index) => ({ ...row, isPrimary: index === 0 }));
  }

  const matchAt = list.findIndex(
    (row) => normalizePersonName(customerContactDisplayName(row)) === normalizePersonName(primaryName),
  );
  if (matchAt >= 0) {
    const current = list[matchAt];
    list[matchAt] = {
      ...current,
      name: customerContactDisplayName(current) || primaryName,
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      phone: current.phone || primary.phone || null,
      email: current.email || primary.email || null,
    };
    if (matchAt !== 0) {
      const [row] = list.splice(matchAt, 1);
      list.unshift(row);
    }
  } else {
    list.unshift({
      name: primaryName,
      firstName,
      lastName,
      phone: primary.phone ?? null,
      email: primary.email ?? null,
      role: null,
      isPrimary: true,
    });
  }

  return list.map((row, index) => ({ ...row, isPrimary: index === 0 }));
}

/** Boş liste mevcut kişileri silmez. */
export function shouldReplaceCustomerContacts(merged: CustomerContactWrite[]): boolean {
  return merged.length > 0;
}
