import { DEFAULT_CUSTOMER_SUB_TYPES } from './customer-form-helpers';

export type DocumentEntityScope = 'vendor' | 'customer';
export type ServiceBranchTypeKey = 'hasar' | 'acil_yardim';

export type DocumentTypeScopeRow = {
  id: string;
  name: string;
  isRequired?: boolean;
  entityScope?: string;
  serviceBranchTypes?: unknown;
  customerSubTypes?: unknown;
  departmentIds?: unknown;
  serviceTypeIds?: unknown;
};

const DEPT_CODE_TO_BRANCH: Record<string, ServiceBranchTypeKey> = {
  'hasar-onarim': 'hasar',
  sovtaj: 'hasar',
  'acil-yardim': 'acil_yardim',
};

export function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function parseServiceBranchTypes(raw: unknown): ServiceBranchTypeKey[] {
  return parseStringList(raw).filter(
    (t): t is ServiceBranchTypeKey => t === 'hasar' || t === 'acil_yardim',
  );
}

export function sortCompareTR(a: string, b: string): number {
  return a.localeCompare(b, 'tr', { sensitivity: 'base' });
}

export function sortByNameTR<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => sortCompareTR(a.name, b.name));
}

export function deriveServiceBranchTypes(
  serviceBranchTypes: unknown,
  departmentIds: unknown,
  deptCodeById: Map<string, string> = new Map(),
): ServiceBranchTypeKey[] {
  const explicit = parseServiceBranchTypes(serviceBranchTypes);
  if (explicit.length > 0) return explicit;

  const fromDepts = parseStringList(departmentIds)
    .map((id) => deptCodeById.get(id))
    .filter((c): c is string => !!c)
    .map((code) => DEPT_CODE_TO_BRANCH[code])
    .filter((t): t is ServiceBranchTypeKey => !!t);

  return [...new Set(fromDepts)];
}

export const VENDOR_SERVICE_TABS: { id: ServiceBranchTypeKey; label: string; color: string }[] = [
  { id: 'hasar', label: 'Hasar Onarım', color: '#3B82F6' },
  { id: 'acil_yardim', label: 'Acil Yardım', color: '#EF4444' },
];

export const CUSTOMER_DOCUMENT_SUB_TYPES = DEFAULT_CUSTOMER_SUB_TYPES.filter((t) =>
  ['insured', 'sigorta_sirketi', 'private_customer', 'eksper', 'eksper_firmasi', 'asistan_firmasi'].includes(t.value),
);

export function matchesServiceBranchType(
  doc: DocumentTypeScopeRow,
  branchType: ServiceBranchTypeKey | undefined,
  deptCodeById: Map<string, string> = new Map(),
): boolean {
  if (!branchType) return true;
  const types = deriveServiceBranchTypes(doc.serviceBranchTypes, doc.departmentIds, deptCodeById);
  if (types.length === 0) return true;
  return types.includes(branchType);
}

export function matchesCustomerSubType(
  doc: DocumentTypeScopeRow,
  subType: string | undefined,
): boolean {
  if (!subType) return true;
  const scope = doc.entityScope ?? 'vendor';
  if (scope !== 'customer') return false;
  const types = parseStringList(doc.customerSubTypes);
  if (types.length === 0) return true;
  return types.includes(subType);
}

export function vendorCategoryToBranchTypes(category: string): ServiceBranchTypeKey[] {
  if (category === 'her_ikisi') return ['hasar', 'acil_yardim'];
  if (category === 'acil') return ['acil_yardim'];
  if (category === 'hasar') return ['hasar'];
  return [];
}

function legacyServiceTypeMatch(ids: string[], category: string): boolean {
  const normalized = ids.map((id) => id.toLowerCase());
  const targets =
    category === 'acil'
      ? ['acil', 'acil_yardim', 'emergency']
      : category === 'her_ikisi'
        ? ['hasar', 'acil', 'acil_yardim', 'her_ikisi', 'both', 'emergency', 'damage']
        : ['hasar', 'damage'];
  return normalized.some((id) => targets.includes(id));
}

export function documentTypeMatchesVendorCategory(
  doc: DocumentTypeScopeRow,
  category: string,
  deptCodeById: Map<string, string> = new Map(),
): boolean {
  const scope = doc.entityScope ?? 'vendor';
  if (scope === 'customer') return false;

  const branchTargets = vendorCategoryToBranchTypes(category);
  const branchTypes = deriveServiceBranchTypes(doc.serviceBranchTypes, doc.departmentIds, deptCodeById);

  if (branchTypes.length > 0) {
    return branchTypes.some((t) => branchTargets.includes(t));
  }

  const deptIds = parseStringList(doc.departmentIds);
  if (deptIds.length > 0 && deptCodeById.size > 0) {
    const allowed =
      category === 'acil'
        ? ['acil-yardim']
        : category === 'her_ikisi'
          ? ['hasar-onarim', 'acil-yardim', 'sovtaj']
          : ['hasar-onarim', 'sovtaj'];
    const docCodes = deptIds
      .map((id) => deptCodeById.get(id))
      .filter((c): c is string => !!c);
    if (docCodes.length === 0) return true;
    return docCodes.some((code) => allowed.includes(code));
  }

  const serviceIds = parseStringList(doc.serviceTypeIds);
  if (serviceIds.length === 0) return true;
  return legacyServiceTypeMatch(serviceIds, category);
}

export function filterDocumentTypesForVendorCategory(
  documentTypes: DocumentTypeScopeRow[],
  category: string,
  deptCodeById: Map<string, string> = new Map(),
): DocumentTypeScopeRow[] {
  const matched = sortByNameTR(
    documentTypes.filter((dt) => documentTypeMatchesVendorCategory(dt, category, deptCodeById)),
  );
  if (matched.length > 0) return matched;
  return sortByNameTR(
    documentTypes.filter((dt) => {
      const scope = dt.entityScope ?? 'vendor';
      if (scope === 'customer') return false;
      const branchTypes = deriveServiceBranchTypes(dt.serviceBranchTypes, dt.departmentIds, deptCodeById);
      const deptIds = parseStringList(dt.departmentIds);
      const serviceIds = parseStringList(dt.serviceTypeIds);
      if (branchTypes.length === 0 && deptIds.length === 0 && serviceIds.length === 0) return true;
      if (serviceIds.length > 0) return legacyServiceTypeMatch(serviceIds, category);
      return false;
    }),
  );
}

export function filterDocumentTypesForCustomerSubType(
  documentTypes: DocumentTypeScopeRow[],
  subType: string | null | undefined,
): DocumentTypeScopeRow[] {
  if (!subType) {
    return sortByNameTR(documentTypes.filter((dt) => (dt.entityScope ?? 'vendor') === 'customer'));
  }
  return sortByNameTR(
    documentTypes.filter((dt) => {
      const scope = dt.entityScope ?? 'vendor';
      if (scope !== 'customer') return false;
      return matchesCustomerSubType(dt, subType);
    }),
  );
}

export function serviceBranchTypeLabel(type: ServiceBranchTypeKey): string {
  return VENDOR_SERVICE_TABS.find((t) => t.id === type)?.label ?? type;
}

export function documentEntityScopeLabel(scope: DocumentEntityScope): string {
  return scope === 'customer' ? 'Müşteri' : 'Tedarikçi';
}

/** Tablo kapsam baloncuğu: evrak sahibi + alt kapsam */
export function vendorScopeBadgeLabel(branch: ServiceBranchTypeKey): string {
  return `${documentEntityScopeLabel('vendor')} · ${serviceBranchTypeLabel(branch)}`;
}

export function customerScopeBadgeLabel(subType: string): string {
  return `${documentEntityScopeLabel('customer')} · ${customerSubTypeScopeLabel(subType)}`;
}

export function documentTypeScopeBadges(
  doc: DocumentTypeScopeRow,
  deptCodeById: Map<string, string> = new Map(),
): string[] {
  const scope = (doc.entityScope ?? 'vendor') as DocumentEntityScope;
  if (scope === 'customer') {
    const subs = parseStringList(doc.customerSubTypes);
    if (subs.length === 0) return [`${documentEntityScopeLabel('customer')} · Tüm Müşteri Tipleri`];
    return subs.map(customerScopeBadgeLabel);
  }
  const branches = deriveServiceBranchTypes(doc.serviceBranchTypes, doc.departmentIds, deptCodeById);
  if (branches.length === 0) {
    return [`${documentEntityScopeLabel('vendor')} · Tüm Hizmet Türleri`];
  }
  return branches.map(vendorScopeBadgeLabel);
}

export function customerSubTypeScopeLabel(value: string): string {
  return CUSTOMER_DOCUMENT_SUB_TYPES.find((t) => t.value === value)?.label ?? value;
}
