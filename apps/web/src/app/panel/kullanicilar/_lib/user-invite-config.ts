export const FIELD_OPERATION_AREA_OPTIONS = [
  { value: 'hasar' as const, label: 'Hasar Onarım' },
  { value: 'acil' as const, label: 'Acil Yardım' },
];

/** Seed (field_staff) ile Ayarlar → Roller (FIELD_STAFF) kod biçimlerini eşleştirir */
export function normalizeRoleCode(code?: string | null): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

export function roleCodesMatch(a?: string | null, b?: string | null): boolean {
  return normalizeRoleCode(a) === normalizeRoleCode(b);
}

export function findRoleByCode<T extends { code: string }>(
  roles: T[],
  code: string,
  ...aliases: string[]
): T | undefined {
  const targets = new Set([code, ...aliases].map(normalizeRoleCode));
  return roles.find((role) => targets.has(normalizeRoleCode(role.code)));
}

export type OperationAreaCode = '' | 'hasar' | 'acil' | 'both';

/** Seed ve canlı ortamda birlikte yaşayan departman kodları */
const DEPARTMENT_CODE_ALIASES: Record<'hasar' | 'acil', string[]> = {
  hasar: ['hasar-onarim', 'HASAR_ONARIM', 'hasar_onarim'],
  acil: ['acil-yardim', 'ACIL_YARDIM', 'acil_yardim', 'acil', 'ACIL'],
};

export interface IhbarKonulari {
  hasar: string[];
  acil: string[];
}

export function departmentCodeMatchesArea(code: string | undefined, area: 'hasar' | 'acil') {
  if (!code) return false;
  const normalized = code.trim().toLowerCase().replace(/_/g, '-');
  return DEPARTMENT_CODE_ALIASES[area].some(
    (alias) => alias.toLowerCase().replace(/_/g, '-') === normalized,
  );
}

export function operationAreaFromDepartmentCodes(codes: Iterable<string | undefined>): OperationAreaCode {
  const normalized = new Set(
    Array.from(codes)
      .filter(Boolean)
      .map((code) => String(code).trim().toLowerCase().replace(/_/g, '-')),
  );
  const hasar = DEPARTMENT_CODE_ALIASES.hasar.some((code) => normalized.has(code.toLowerCase().replace(/_/g, '-')));
  const acil = DEPARTMENT_CODE_ALIASES.acil.some((code) => normalized.has(code.toLowerCase().replace(/_/g, '-')));
  if (hasar && acil) return 'both';
  if (hasar) return 'hasar';
  if (acil) return 'acil';
  return '';
}

export function findDepartmentForArea(
  departments: Array<{ id: string; code: string }>,
  area: 'hasar' | 'acil',
) {
  const aliases = DEPARTMENT_CODE_ALIASES[area];
  return departments.find((department) => aliases.includes(department.code));
}

export function ihbarSubjectsForArea(konular: IhbarKonulari, area: OperationAreaCode): string[] {
  if (area === 'hasar') return konular.hasar;
  if (area === 'acil') return konular.acil;
  return [];
}

export function showsInsuranceCompanyScope(operationArea: OperationAreaCode) {
  return operationArea === 'hasar' || operationArea === 'both';
}

export function showsAcilYardimCustomerScope(operationArea: OperationAreaCode) {
  return operationArea === 'acil' || operationArea === 'both';
}

/** Dosya sorumlusu: acil yardımda il/ilçe kapsamı uygulanmaz; yalnız hasar veya her ikisi. */
export function showsOperationsServiceAreaScope(operationArea: OperationAreaCode) {
  return operationArea === 'hasar' || operationArea === 'both';
}

/** Müşteriler → kurumsal → alt tip Asistan Firması */
export const ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE = 'asistan_firmasi';

export interface AcilYardimAssistantCustomerRecord {
  id: string;
  entityType?: string;
  subType?: string | null;
  serviceType?: string | null;
  status?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}

export function acilYardimAssistantCustomerName(customer: AcilYardimAssistantCustomerRecord) {
  return (customer.companyName ?? customer.fullName ?? '').trim();
}

export function isAcilYardimAssistantCustomer(customer: AcilYardimAssistantCustomerRecord) {
  if (customer.status && customer.status !== 'active') return false;
  if (customer.entityType && customer.entityType !== 'corporate') return false;
  return customer.subType === ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE;
}

/** Müşteriler → kurumsal → alt tip Eksper Firması (hasar ihbar cari) */
export const HASAR_EXPERT_CUSTOMER_SUB_TYPE = 'eksper_firmasi';

export interface HasarExpertCustomerRecord {
  id: string;
  entityType?: string;
  subType?: string | null;
  serviceType?: string | null;
  status?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}

export function hasarExpertCustomerName(customer: HasarExpertCustomerRecord) {
  return (customer.companyName ?? customer.fullName ?? '').trim();
}

export function isHasarExpertCustomer(customer: HasarExpertCustomerRecord) {
  if (customer.status && customer.status !== 'active') return false;
  if (customer.entityType && customer.entityType !== 'corporate') return false;
  return customer.subType === HASAR_EXPERT_CUSTOMER_SUB_TYPE || customer.subType === 'eksper';
}

/** Müşteriler → kurumsal → alt tip Broker Firması */
export const BROKER_CUSTOMER_SUB_TYPE = 'broker_firmasi';

export interface BrokerCustomerRecord {
  id: string;
  entityType?: string;
  subType?: string | null;
  status?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}

export function brokerCustomerName(customer: BrokerCustomerRecord) {
  return (customer.companyName ?? customer.fullName ?? '').trim();
}

export function isBrokerCustomer(customer: BrokerCustomerRecord) {
  if (customer.status && customer.status !== 'active') return false;
  if (customer.entityType && customer.entityType !== 'corporate') return false;
  return customer.subType === BROKER_CUSTOMER_SUB_TYPE;
}

/** Saha operasyonu — tanımlı iş kolu dışı açıklama (Acil Yardım) */
export const FIELD_OTHER_SUBJECT_LABEL = 'Diğer';

export interface FieldOperationServiceBranch {
  id: string;
  name: string;
  type: 'hasar' | 'acil_yardim' | string;
  isActive?: boolean;
  sortOrder?: number;
}

/** İhbar konusu ile karışmış eski branş adları — saha operasyon listesinde gösterilmez */
const CLAIM_SUBJECT_LIKE_SERVICE_BRANCHES = new Set([
  'Konut Yangın',
  'Dahili Su',
  'Endüstriyel Yangın',
  'Deprem',
  'Hırsızlık',
  'Cam Kırılması',
  'Doğal Afet',
  'Elektronik Cihaz',
  'Makine Kırılması',
  'Acil Su',
  'Acil Elektrik',
  'Yangın',
  'Fırtına',
  'Dolu',
  'Sel/Su Baskını',
  'Terör',
]);

const FALLBACK_OPERATIONAL_SERVICE_BRANCHES: Record<'hasar' | 'acil_yardim', string[]> = {
  hasar: [
    'Boyacı',
    'Sıvacı',
    'Alçıpan',
    'Seramik',
    'Parke',
    'Mermerci',
    'Marangoz / Mobilyacı',
    'Camcı',
    'Elektrikçi',
    'Tesisatçı',
  ],
  acil_yardim: [
    'Çilingir',
    'Elektrikçi',
    'Tesisatçı',
    'Camcı',
    'Kombi / Klima',
    'Beyaz Eşya',
    'Çatı Ustası',
    'Haşere İlaçlama',
  ],
};

function fallbackFieldOperationBranches(type: 'hasar' | 'acil_yardim'): FieldOperationServiceBranch[] {
  return FALLBACK_OPERATIONAL_SERVICE_BRANCHES[type].map((name, index) => ({
    id: `fallback-${type}-${index}`,
    name,
    type,
    isActive: true,
    sortOrder: index,
  }));
}

export function sanitizeFieldOperationServiceBranches(
  branches: FieldOperationServiceBranch[],
  type: 'hasar' | 'acil_yardim',
): FieldOperationServiceBranch[] {
  const clean = branches
    .filter((branch) => branch.type === type)
    .filter((branch) => branch.isActive !== false)
    .filter((branch) => !CLAIM_SUBJECT_LIKE_SERVICE_BRANCHES.has(branch.name));

  return clean.length >= 3 ? clean : fallbackFieldOperationBranches(type);
}

export function fieldOperationBranchOptions(
  branches: FieldOperationServiceBranch[],
  operationArea: 'hasar' | 'acil',
): FieldOperationServiceBranch[] {
  const type = operationArea === 'hasar' ? 'hasar' : 'acil_yardim';
  return sanitizeFieldOperationServiceBranches(branches, type);
}
