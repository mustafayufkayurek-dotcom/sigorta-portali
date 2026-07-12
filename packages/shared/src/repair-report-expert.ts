export type RepairReportExpertSource = {
  inspectorName?: string | null;
  expertOffice?: { companyName?: string | null } | null;
  claimFile?: {
    assignedInspectorVendor?: { name?: string | null } | null;
    assignedOfficeUser?: { firstName?: string | null; lastName?: string | null } | null;
    assignedAdjuster?: { firstName?: string | null; lastName?: string | null } | null;
  } | null;
};

export type FileExpertInfo = {
  name: string;
  missing: boolean;
};

function officeUserFullName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

/** Dosya eksperi: atanmış eksper firması veya expertOffice; dosya sorumlusu eksper sayılmaz. */
export function resolveRepairReportExpertName(source: RepairReportExpertSource): string | null {
  const vendor = source.claimFile?.assignedInspectorVendor?.name?.trim();
  if (vendor) return vendor;

  const expertOffice = source.expertOffice?.companyName?.trim();
  if (expertOffice) return expertOffice;

  const inspector = source.inspectorName?.trim();
  if (!inspector) return null;

  const officeName = officeUserFullName(source.claimFile?.assignedOfficeUser);
  if (officeName && inspector === officeName) return null;

  const adjusterName = officeUserFullName(source.claimFile?.assignedAdjuster);
  if (adjusterName && inspector === adjusterName) return null;

  return inspector;
}

/** Rapor ve dosya detayında aynı eksper kaynağı — müşteri kartı / vendor / expertOffice zinciri. */
export function resolveFileExpertDisplay(source: RepairReportExpertSource | null | undefined): FileExpertInfo {
  if (!source) return { name: 'Atanmamış', missing: true };
  const name = resolveRepairReportExpertName(source);
  if (name) return { name, missing: false };
  return { name: 'Atanmamış', missing: true };
}
