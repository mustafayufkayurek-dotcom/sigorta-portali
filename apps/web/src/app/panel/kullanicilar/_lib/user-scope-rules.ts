export type ScopeVisibility = 'hidden' | 'optional' | 'required';

export interface RoleScopeRules {
  departmentScope: ScopeVisibility;
  primaryDepartment: ScopeVisibility;
  operationScope: ScopeVisibility;
  assignmentEnabled: ScopeVisibility;
  assignmentRole: ScopeVisibility;
  countrywide: ScopeVisibility;
  regionScope: ScopeVisibility;
  workflowScope: ScopeVisibility;
}

export interface ScopeFormState {
  departmentIds: string[];
  primaryDepartmentId: string;
  operationScope: string;
  workflowScopeCodes: string[];
  assignmentEnabled: boolean;
  assignmentRoleCode: string;
  countrywide: boolean;
  serviceAreas: Array<{ provinceId: string; districtId: string | null }>;
}

const DEFAULT_RULES: RoleScopeRules = {
  departmentScope: 'hidden',
  primaryDepartment: 'hidden',
  operationScope: 'hidden',
  assignmentEnabled: 'hidden',
  assignmentRole: 'hidden',
  countrywide: 'hidden',
  regionScope: 'hidden',
  workflowScope: 'hidden',
};

const ROLE_RULES: Record<string, RoleScopeRules> = {
  admin: {
    departmentScope: 'optional',
    primaryDepartment: 'optional',
    operationScope: 'optional',
    assignmentEnabled: 'optional',
    assignmentRole: 'optional',
    countrywide: 'optional',
    regionScope: 'optional',
    workflowScope: 'optional',
  },
  manager: {
    departmentScope: 'optional',
    primaryDepartment: 'optional',
    operationScope: 'required',
    assignmentEnabled: 'optional',
    assignmentRole: 'optional',
    countrywide: 'optional',
    regionScope: 'optional',
    workflowScope: 'optional',
  },
  office_staff: {
    departmentScope: 'required',
    primaryDepartment: 'required',
    operationScope: 'required',
    assignmentEnabled: 'optional',
    assignmentRole: 'required',
    countrywide: 'optional',
    regionScope: 'required',
    workflowScope: 'required',
  },
  finance: {
    departmentScope: 'optional',
    primaryDepartment: 'optional',
    operationScope: 'required',
    assignmentEnabled: 'hidden',
    assignmentRole: 'hidden',
    countrywide: 'hidden',
    regionScope: 'hidden',
    workflowScope: 'required',
  },
  field_staff: {
    departmentScope: 'required',
    primaryDepartment: 'required',
    operationScope: 'required',
    assignmentEnabled: 'required',
    assignmentRole: 'required',
    countrywide: 'required',
    regionScope: 'required',
    workflowScope: 'optional',
  },
  adjuster: {
    departmentScope: 'required',
    primaryDepartment: 'required',
    operationScope: 'required',
    assignmentEnabled: 'required',
    assignmentRole: 'required',
    countrywide: 'required',
    regionScope: 'required',
    workflowScope: 'optional',
  },
  expert: {
    departmentScope: 'required',
    primaryDepartment: 'required',
    operationScope: 'required',
    assignmentEnabled: 'required',
    assignmentRole: 'required',
    countrywide: 'required',
    regionScope: 'required',
    workflowScope: 'optional',
  },
  insurance_co: DEFAULT_RULES,
  insurance_company_user: DEFAULT_RULES,
};

export function getRoleScopeRules(roleCode?: string | null): RoleScopeRules {
  if (!roleCode) {
    return DEFAULT_RULES;
  }

  return ROLE_RULES[roleCode] ?? DEFAULT_RULES;
}

export function isVisible(visibility: ScopeVisibility) {
  return visibility !== 'hidden';
}

export function isRequired(visibility: ScopeVisibility) {
  return visibility === 'required';
}

export function sanitizeScopeByRole(scope: ScopeFormState, roleCode?: string | null): ScopeFormState {
  const rules = getRoleScopeRules(roleCode);
  const next: ScopeFormState = {
    ...scope,
    departmentIds: [...scope.departmentIds],
    workflowScopeCodes: [...scope.workflowScopeCodes],
    serviceAreas: [...scope.serviceAreas],
  };

  if (!isVisible(rules.departmentScope)) {
    next.departmentIds = [];
  }

  if (!isVisible(rules.primaryDepartment) || !next.departmentIds.includes(next.primaryDepartmentId)) {
    next.primaryDepartmentId = '';
  }

  if (!isVisible(rules.operationScope)) {
    next.operationScope = '';
  }

  if (!isVisible(rules.assignmentEnabled)) {
    next.assignmentEnabled = false;
  }

  if (!isVisible(rules.assignmentRole) || !next.assignmentEnabled) {
    next.assignmentRoleCode = '';
  }

  if (!isVisible(rules.countrywide)) {
    next.countrywide = true;
  }

  if (!isVisible(rules.regionScope) || next.countrywide) {
    next.serviceAreas = [];
  }

  if (!isVisible(rules.workflowScope)) {
    next.workflowScopeCodes = [];
  }

  return next;
}