export type RepairReportExpertSource = {
  inspectorName?: string | null;
  expertOffice?: { companyName?: string | null; fullName?: string | null } | null;
  claimFile?: {
    assignedInspectorVendor?: { name?: string | null } | null;
    assignedOfficeUser?: { firstName?: string | null; lastName?: string | null } | null;
    assignedAdjuster?: { firstName?: string | null; lastName?: string | null } | null;
    /** Hasar dosyasında müşteri genelde ekspertiz firmasıdır (müşteri kartı). */
    customer?: {
      companyName?: string | null;
      fullName?: string | null;
      type?: string | null;
      entityType?: string | null;
      subType?: string | null;
    } | null;
  } | null;
};

export type FileExpertInfo = {
  name: string;
  missing: boolean;
};

/** Sigortalı / asistan / sigorta — eksper ofisi sayılmaz */
const NON_EXPERT_CUSTOMER_SUB_TYPES = new Set([
  'insured',
  'private_customer',
  'asistan_firmasi',
  'sigorta_sirketi',
  'broker_firmasi',
]);

const EXPERT_CUSTOMER_SUB_TYPES = new Set(['eksper_firmasi', 'eksper']);

function officeUserFullName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

function customerDisplayName(
  customer?: {
    companyName?: string | null;
    fullName?: string | null;
  } | null,
): string {
  if (!customer) return '';
  return (customer.companyName ?? customer.fullName ?? '').trim();
}

/**
 * Müşteri kartı ekspertiz firması mı?
 * - subType eksper / eksper_firmasi → evet
 * - insured / asistan / sigorta / broker → hayır
 * - subType boş + kurumsal → hasar akışında müşteri = eksper ofisi (legacy)
 */
export function isExpertFirmCustomer(
  customer?: {
    companyName?: string | null;
    fullName?: string | null;
    type?: string | null;
    entityType?: string | null;
    subType?: string | null;
  } | null,
): boolean {
  if (!customer) return false;
  const sub = (customer.subType ?? '').trim().toLowerCase();
  if (sub && EXPERT_CUSTOMER_SUB_TYPES.has(sub)) return true;
  if (sub && NON_EXPERT_CUSTOMER_SUB_TYPES.has(sub)) return false;
  const kind = (customer.type ?? customer.entityType ?? '').trim().toLowerCase();
  if (kind === 'corporate') return Boolean(customerDisplayName(customer));
  return false;
}

function resolveCustomerExpertName(source: RepairReportExpertSource): string | null {
  const customer = source.claimFile?.customer;
  if (!isExpertFirmCustomer(customer)) return null;
  const name = customerDisplayName(customer);
  return name || null;
}

/** Dosya eksperi: tespitçi vendor → expertOffice → atanmış eksper → müşteri kartı → inspectorName (sorumlu filtreli). */
export function resolveRepairReportExpertName(source: RepairReportExpertSource): string | null {
  const vendor = source.claimFile?.assignedInspectorVendor?.name?.trim();
  if (vendor) return vendor;

  const expertOffice =
    source.expertOffice?.companyName?.trim()
    || source.expertOffice?.fullName?.trim()
    || '';
  if (expertOffice) return expertOffice;

  const assignedAdjuster = officeUserFullName(source.claimFile?.assignedAdjuster);
  if (assignedAdjuster) return assignedAdjuster;

  const customerExpert = resolveCustomerExpertName(source);
  if (customerExpert) return customerExpert;

  const inspector = source.inspectorName?.trim();
  if (!inspector) return null;

  const officeName = officeUserFullName(source.claimFile?.assignedOfficeUser);
  if (officeName && inspector === officeName) return null;

  if (assignedAdjuster && inspector === assignedAdjuster) return null;

  return inspector;
}

/** Dosya sorumlusu adı eksper olarak kullanılmamalı — legacy rapor verisi temizliği */
function sanitizeInspectorName(source: RepairReportExpertSource): string | null {
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
  const name = resolveRepairReportExpertName({
    ...source,
    inspectorName: sanitizeInspectorName(source) ?? source.inspectorName,
  });
  if (name) return { name, missing: false };
  return { name: 'Atanmamış', missing: true };
}
