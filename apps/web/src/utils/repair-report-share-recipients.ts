export type ShareRecipient = {
  key: string;
  label: string;
  subtitle?: string;
  phone: string;
  group?: 'default' | 'vendor';
};

function normalizeTrPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10 || !digits.startsWith('5')) return null;
  return digits;
}

function pushRecipient(
  list: ShareRecipient[],
  seen: Set<string>,
  key: string,
  label: string,
  phoneRaw: string | null | undefined,
  subtitle?: string,
  group: 'default' | 'vendor' = 'default',
) {
  const phone = normalizeTrPhone(phoneRaw);
  if (!phone || seen.has(phone)) return;
  seen.add(phone);
  list.push({ key, label, subtitle, phone, group });
}

export type ClaimVendorSource = {
  id: string;
  name: string;
  phone?: string | null;
  authorizedPhone?: string | null;
};

/** Dosya ve rapor verisinden WhatsApp alıcı listesi oluşturur. */
export function buildRepairReportShareRecipients(
  report: {
    claimFile?: {
      insuredPhone?: string | null;
      insuredName?: string | null;
      customer?: {
        fullName?: string | null;
        companyName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        contacts?: { name?: string | null; role?: string | null; phone?: string | null; isPrimary?: boolean }[];
      } | null;
      assignedFieldUser?: { firstName?: string; lastName?: string; phone?: string | null } | null;
      assignedAdjuster?: { firstName?: string; lastName?: string; phone?: string | null } | null;
      assignedSupplier?: { id?: string; name?: string | null; phone?: string | null; authorizedPhone?: string | null } | null;
      assignedSuppliers?: { id?: string; name?: string | null; phone?: string | null; authorizedPhone?: string | null }[] | null;
      supplierAssignments?: { vendor?: { id?: string; name?: string | null; phone?: string | null; authorizedPhone?: string | null } | null }[] | null;
    } | null;
    expertOffice?: { companyName?: string | null; phone?: string | null } | null;
  } | null | undefined,
  claimVendors: ClaimVendorSource[] = [],
): ShareRecipient[] {
  if (!report) return [];
  const cf = report.claimFile;
  const list: ShareRecipient[] = [];
  const seen = new Set<string>();

  const customerName =
    cf?.customer?.fullName
    ?? cf?.customer?.companyName
    ?? [cf?.customer?.firstName, cf?.customer?.lastName].filter(Boolean).join(' ')
    ?? cf?.insuredName
    ?? undefined;

  pushRecipient(list, seen, 'insured', 'Sigortalı', cf?.insuredPhone ?? cf?.customer?.phone, customerName);

  for (const contact of cf?.customer?.contacts ?? []) {
    if (!contact.phone) continue;
    const label = contact.role?.trim() ? toTitleCaseLabel(contact.role) : 'Sigortalı İletişim';
    pushRecipient(list, seen, `contact-${contact.name ?? contact.phone}`, label, contact.phone, contact.name ?? undefined);
  }

  if (report.expertOffice?.phone) {
    pushRecipient(
      list,
      seen,
      'expert-office',
      'Eksper Ofisi',
      report.expertOffice.phone,
      report.expertOffice.companyName ?? undefined,
    );
  }

  const fieldUser = cf?.assignedFieldUser;
  if (fieldUser?.phone) {
    pushRecipient(
      list,
      seen,
      'field-user',
      'Saha Sorumlusu',
      fieldUser.phone,
      [fieldUser.firstName, fieldUser.lastName].filter(Boolean).join(' ') || undefined,
    );
  }

  const adjuster = cf?.assignedAdjuster;
  if (adjuster?.phone) {
    pushRecipient(
      list,
      seen,
      'adjuster',
      'Eksper',
      adjuster.phone,
      [adjuster.firstName, adjuster.lastName].filter(Boolean).join(' ') || undefined,
    );
  }

  const supplier = cf?.assignedSupplier;
  if (supplier?.phone || supplier?.authorizedPhone) {
    pushRecipient(
      list,
      seen,
      `supplier-${supplier.id ?? supplier.name ?? 'assigned'}`,
      supplier.name ?? 'Tedarikçi',
      supplier.authorizedPhone ?? supplier.phone,
      supplier.name ?? undefined,
      'vendor',
    );
  }

  const multiFromFlat = cf?.assignedSuppliers ?? [];
  const multiFromJoin = (cf?.supplierAssignments ?? [])
    .map((s) => s.vendor)
    .filter(Boolean) as ClaimVendorSource[];
  for (const vendor of [...multiFromFlat, ...multiFromJoin]) {
    if (!vendor?.id && !vendor?.name) continue;
    pushRecipient(
      list,
      seen,
      `supplier-${vendor.id ?? vendor.name}`,
      vendor.name ?? 'Tedarikçi',
      vendor.authorizedPhone ?? vendor.phone,
      vendor.name ?? undefined,
      'vendor',
    );
  }

  for (const vendor of claimVendors) {
    pushRecipient(
      list,
      seen,
      `vendor-${vendor.id}`,
      vendor.name,
      vendor.authorizedPhone ?? vendor.phone,
      vendor.name,
      'vendor',
    );
  }

  return list;
}

function toTitleCaseLabel(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}
