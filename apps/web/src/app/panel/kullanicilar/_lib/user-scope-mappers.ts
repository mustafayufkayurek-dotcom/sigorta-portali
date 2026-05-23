import { ScopeFormState, getRoleScopeRules, isVisible, sanitizeScopeByRole } from './user-scope-rules';

export interface UserScopePayload extends ScopeFormState {}

export interface UserFormPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  status: string;
  scope: UserScopePayload;
}

export function buildEmptyScope(): ScopeFormState {
  return {
    departmentIds: [],
    primaryDepartmentId: '',
    operationScope: '',
    workflowScopeCodes: [],
    assignmentEnabled: false,
    assignmentRoleCode: '',
    countrywide: true,
    serviceAreas: [],
  };
}

export function hydrateScopeFromUser(user: any, roleCode?: string | null): ScopeFormState {
  const departmentMemberships = Array.isArray(user?.departmentMemberships) ? user.departmentMemberships : [];
  const responsibilityAssignments = Array.isArray(user?.responsibilityAssignments) ? user.responsibilityAssignments : [];
  const serviceAreas = Array.isArray(user?.serviceAreas) ? user.serviceAreas : [];
  const activeAssignment = responsibilityAssignments.find((item: any) => item?.isActive !== false) ?? responsibilityAssignments[0];

  const scope: ScopeFormState = {
    departmentIds: departmentMemberships.map((item: any) => item.departmentId).filter(Boolean),
    primaryDepartmentId: departmentMemberships.find((item: any) => item.isPrimary)?.departmentId ?? '',
    operationScope: activeAssignment?.coverageType ?? '',
    workflowScopeCodes: serviceAreas
      .map((item: any) => item.workflowCode ?? item.coverageType ?? item.provinceId)
      .filter(Boolean),
    assignmentEnabled: responsibilityAssignments.length > 0,
    assignmentRoleCode: activeAssignment?.coverageType ?? '',
    countrywide: responsibilityAssignments.length > 0
      ? responsibilityAssignments.every((item: any) => item.countrywide !== false)
      : true,
    serviceAreas: serviceAreas.map((item: any) => ({
      provinceId: item.provinceId,
      districtId: item.districtId ?? null,
    })),
  };

  return sanitizeScopeByRole(scope, roleCode);
}

export function buildUserPayload(form: UserFormPayload, roleCode?: string | null) {
  const normalizedScope = sanitizeScopeByRole(form.scope, roleCode);
  const rules = getRoleScopeRules(roleCode);

  const payload: Record<string, any> = {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone || undefined,
    roleId: form.roleId,
    status: form.status || undefined,
  };

  if (form.password) {
    payload.password = form.password;
  }

  if (isVisible(rules.departmentScope)) {
    payload.departmentMemberships = normalizedScope.departmentIds.map((departmentId) => ({
      departmentId,
      isPrimary: normalizedScope.primaryDepartmentId === departmentId,
    }));
  }

  if (isVisible(rules.assignmentEnabled)) {
    payload.responsibilityAssignments = normalizedScope.assignmentEnabled && normalizedScope.departmentIds.length > 0
      ? normalizedScope.departmentIds.map((departmentId) => ({
          departmentId,
          countrywide: normalizedScope.countrywide,
          coverageType: normalizedScope.assignmentRoleCode || normalizedScope.operationScope || 'standard',
        }))
      : [];
  }

  return payload;
}