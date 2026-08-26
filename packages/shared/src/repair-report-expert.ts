export type RepairReportExpertSource = {
  inspectorName?: string | null;
  expertOffice?: { companyName?: string | null; fullName?: string | null } | null;
  claimFile?: {
    /** Saha tespitçi tedarikçisi — Dosya Eksperi değildir. */
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

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr');
}

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

function inspectorVendorName(source: RepairReportExpertSource): string {
  return source.claimFile?.assignedInspectorVendor?.name?.trim() || '';
}

function isInspectorVendorName(source: RepairReportExpertSource, name: string): boolean {
  const vendor = inspectorVendorName(source);
  return Boolean(vendor && namesMatch(name, vendor));
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

/**
 * Dosya eksperi (onay muhatabı / başlık «Eksper»):
 * atanmış eksper kişi → eksper ofisi → müşteri kartı (eksper_firmasi) → temiz inspectorName.
 * Saha tespitçi tedarikçisi (`assignedInspectorVendor`) asla Dosya Eksperi değildir.
 */
export function resolveRepairReportExpertName(source: RepairReportExpertSource): string | null {
  const assignedAdjuster = officeUserFullName(source.claimFile?.assignedAdjuster);
  if (assignedAdjuster && !isInspectorVendorName(source, assignedAdjuster)) return assignedAdjuster;

  const expertOffice =
    source.expertOffice?.companyName?.trim()
    || source.expertOffice?.fullName?.trim()
    || '';
  if (expertOffice && !isInspectorVendorName(source, expertOffice)) return expertOffice;

  const customerExpert = resolveCustomerExpertName(source);
  if (customerExpert && !isInspectorVendorName(source, customerExpert)) return customerExpert;

  const inspector = sanitizeInspectorName(source);
  return inspector;
}

/** Dosya sorumlusu / tespitçi tedarikçi adı eksper olarak kullanılmamalı */
function sanitizeInspectorName(source: RepairReportExpertSource): string | null {
  const inspector = source.inspectorName?.trim();
  if (!inspector) return null;
  const officeName = officeUserFullName(source.claimFile?.assignedOfficeUser);
  if (officeName && namesMatch(inspector, officeName)) return null;
  const adjusterName = officeUserFullName(source.claimFile?.assignedAdjuster);
  if (adjusterName && namesMatch(inspector, adjusterName)) return null;
  if (isInspectorVendorName(source, inspector)) return null;
  return inspector;
}

/** Rapor ve dosya detayında aynı eksper kaynağı — tespitçi vendor yok. */
export function resolveFileExpertDisplay(source: RepairReportExpertSource | null | undefined): FileExpertInfo {
  if (!source) return { name: 'Atanmamış', missing: true };
  const name = resolveRepairReportExpertName(source);
  if (name) return { name, missing: false };
  return { name: 'Atanmamış', missing: true };
}

/**
 * Hasar dosya üst bantı.
 * Eksper ofisi yalnız müşteri eksper firmasıysa yazılır.
 * İhbar sigorta şirketinden gelince eksper ofisi aranmaz.
 */
export function buildHasarHeaderBandParts(input: {
  customer?: Parameters<typeof isExpertFirmCustomer>[0];
  insuranceCompany?: { name?: string | null } | null;
  fileNo: string;
  konu?: string | null;
}): string[] {
  const parts: string[] = [];
  const insurance = String(input.insuranceCompany?.name ?? '').trim();
  const customerName = customerDisplayName(input.customer);
  const customerOk = Boolean(customerName);

  if (isExpertFirmCustomer(input.customer) && customerOk) {
    parts.push(customerName);
  }
  if (insurance && !parts.some((p) => namesMatch(p, insurance))) {
    parts.push(insurance);
  } else if (!isExpertFirmCustomer(input.customer) && customerOk && !parts.some((p) => namesMatch(p, customerName))) {
    parts.push(customerName);
  }

  const fileNo = String(input.fileNo ?? '').trim();
  if (fileNo) parts.push(fileNo);

  const konu = String(input.konu ?? '').trim();
  if (konu && konu !== '—') parts.push(konu);

  return parts;
}
