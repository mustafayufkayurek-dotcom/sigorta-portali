import { ScopeFormState, getRoleScopeRules, isRequired, isVisible } from './user-scope-rules';

export interface ScopeValidationErrors {
  departmentIds?: string;
  primaryDepartmentId?: string;
  operationScope?: string;
  workflowScopeCodes?: string;
  assignmentRoleCode?: string;
  serviceAreas?: string;
}

export function validateUserScope(scope: ScopeFormState, roleCode?: string | null): ScopeValidationErrors {
  const rules = getRoleScopeRules(roleCode);
  const errors: ScopeValidationErrors = {};

  if (isRequired(rules.departmentScope) && scope.departmentIds.length === 0) {
    errors.departmentIds = 'En az bir departman seçilmelidir.';
  }

  if (isVisible(rules.primaryDepartment) && scope.departmentIds.length > 0 && !scope.departmentIds.includes(scope.primaryDepartmentId)) {
    errors.primaryDepartmentId = 'Varsayılan departman seçili departmanlardan biri olmalıdır.';
  }

  if (isRequired(rules.primaryDepartment) && !scope.primaryDepartmentId) {
    errors.primaryDepartmentId = 'Varsayılan departman zorunludur.';
  }

  if (isRequired(rules.operationScope) && !scope.operationScope) {
    errors.operationScope = 'Çalışma kapsamı zorunludur.';
  }

  if (isVisible(rules.assignmentRole) && scope.assignmentEnabled && !scope.assignmentRoleCode) {
    errors.assignmentRoleCode = 'Dosya atama rolü zorunludur.';
  }

  if (isVisible(rules.regionScope) && !scope.countrywide && scope.serviceAreas.length === 0) {
    errors.serviceAreas = 'Bölge kapsamı seçilmelidir.';
  }

  if (isRequired(rules.workflowScope) && scope.workflowScopeCodes.length === 0) {
    errors.workflowScopeCodes = 'En az bir iş akışı kapsamı seçilmelidir.';
  }

  return errors;
}