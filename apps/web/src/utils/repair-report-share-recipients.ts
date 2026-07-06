export type ShareRecipient = {
  key: string;
  label: string;
  subtitle?: string;
  phone: string;
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
) {
  const phone = normalizeTrPhone(phoneRaw);
  if (!phone || seen.has(phone)) return;
  seen.add(phone);
  list.push({ key, label, subtitle, phone });
}

/** Dosya ve rapor verisinden WhatsApp alıcı listesi oluşturur. */
export function buildRepairReportShareRecipients(report: {
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
    assignedOfficeUser?: { firstName?: string; lastName?: string; phone?: string | null } | null;
    assignedAdjuster?: { firstName?: string; lastName?: string; phone?: string | null } | null;
  } | null;
  expertOffice?: { companyName?: string | null; phone?: string | null } | null;
} | null | undefined): ShareRecipient[] {
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

  const officeUser = cf?.assignedOfficeUser;
  if (officeUser?.phone) {
    pushRecipient(
      list,
      seen,
      'office-user',
      'Ofis Sorumlusu',
      officeUser.phone,
      [officeUser.firstName, officeUser.lastName].filter(Boolean).join(' ') || undefined,
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

  return list;
}

function toTitleCaseLabel(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}
