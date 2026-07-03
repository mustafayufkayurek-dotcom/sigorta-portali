export type DocumentEntityScope = 'vendor' | 'customer';
export type ServiceBranchTypeKey = 'hasar' | 'acil_yardim';

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

export function sortCompareTR(a: string, b: string): number {
  return a.localeCompare(b, 'tr', { sensitivity: 'base' });
}

export function matchesServiceBranchType(
  doc: { serviceBranchTypes?: unknown; departmentIds?: unknown },
  branchType: ServiceBranchTypeKey | undefined,
  deptCodeById: Map<string, string> = new Map(),
): boolean {
  if (!branchType) return true;
  const types = deriveServiceBranchTypes(doc.serviceBranchTypes, doc.departmentIds, deptCodeById);
  if (types.length === 0) return true;
  return types.includes(branchType);
}

export function matchesCustomerSubType(
  doc: { customerSubTypes?: unknown; entityScope?: string },
  subType: string | undefined,
): boolean {
  if (!subType) return true;
  if (doc.entityScope && doc.entityScope !== 'customer') return false;
  const types = parseStringList(doc.customerSubTypes);
  if (types.length === 0) return true;
  return types.includes(subType);
}

export function matchesEntityScope(
  doc: { entityScope?: string },
  scope: DocumentEntityScope | undefined,
): boolean {
  if (!scope) return true;
  const docScope = (doc.entityScope ?? 'vendor') as DocumentEntityScope;
  return docScope === scope;
}

export function vendorCategoryToBranchType(category: string): ServiceBranchTypeKey | null {
  if (category === 'hasar' || category === 'her_ikisi') return 'hasar';
  if (category === 'acil') return 'acil_yardim';
  return null;
}

export function scopesOverlap(
  a: {
    entityScope?: string;
    serviceBranchTypes?: unknown;
    customerSubTypes?: unknown;
    departmentIds?: unknown;
  },
  b: {
    entityScope?: string;
    serviceBranchTypes?: unknown;
    customerSubTypes?: unknown;
    departmentIds?: unknown;
  },
  deptCodeById: Map<string, string> = new Map(),
): boolean {
  const scopeA = (a.entityScope ?? 'vendor') as DocumentEntityScope;
  const scopeB = (b.entityScope ?? 'vendor') as DocumentEntityScope;
  if (scopeA !== scopeB) return false;

  if (scopeA === 'vendor') {
    const typesA = deriveServiceBranchTypes(a.serviceBranchTypes, a.departmentIds, deptCodeById);
    const typesB = deriveServiceBranchTypes(b.serviceBranchTypes, b.departmentIds, deptCodeById);
    if (typesA.length === 0 || typesB.length === 0) return true;
    return typesA.some((t) => typesB.includes(t));
  }

  const subA = parseStringList(a.customerSubTypes);
  const subB = parseStringList(b.customerSubTypes);
  if (subA.length === 0 || subB.length === 0) return true;
  return subA.some((t) => subB.includes(t));
}
