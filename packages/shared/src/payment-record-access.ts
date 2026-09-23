/** Ofis personeli başka dosyanın ödeme / dekont kaydını açmaz. */

function normalizeRoleCode(roleCode: string | null | undefined): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

export const PAYMENT_RECORD_ACCESS_MESSAGE = 'Bu kayda erişiminiz yok.';

const PRIVILEGED_PAYMENT_ROLES = new Set([
  'admin',
  'manager',
  'finance',
  'finans',
  'accountant',
]);

export function isPrivilegedPaymentViewer(roleCode: string | null | undefined): boolean {
  return PRIVILEGED_PAYMENT_ROLES.has(normalizeRoleCode(roleCode));
}

export function isOfficeStaffPaymentViewer(roleCode: string | null | undefined): boolean {
  return normalizeRoleCode(roleCode) === 'office_staff';
}

export function isFieldStaffPaymentViewer(roleCode: string | null | undefined): boolean {
  return normalizeRoleCode(roleCode) === 'field_staff';
}

export type PaymentFileOwnership = {
  assignedOfficeUserId?: string | null;
  currentResponsibleUserId?: string | null;
  assignedFieldUserId?: string | null;
  insuranceCompanyId?: string | null;
};

export type PaymentEmergencyOwnership = {
  assignedUserId?: string | null;
  assignedFieldUserId?: string | null;
};

/** Liste ile aynı: dosya bu personele bağlı mı. */
export function officeStaffOwnsPaymentFile(
  userId: string,
  claimFile?: PaymentFileOwnership | null,
  emergencyCase?: PaymentEmergencyOwnership | null,
): boolean {
  if (!userId) return false;
  if (claimFile) {
    if (claimFile.assignedOfficeUserId === userId) return true;
    if (claimFile.currentResponsibleUserId === userId) return true;
    if (claimFile.assignedFieldUserId === userId) return true;
  }
  if (emergencyCase) {
    if (emergencyCase.assignedUserId === userId) return true;
    if (emergencyCase.assignedFieldUserId === userId) return true;
  }
  return false;
}

export function fieldStaffOwnsPaymentFile(
  userId: string,
  claimFile?: PaymentFileOwnership | null,
  emergencyCase?: PaymentEmergencyOwnership | null,
): boolean {
  if (!userId) return false;
  if (claimFile?.assignedFieldUserId === userId) return true;
  if (emergencyCase?.assignedFieldUserId === userId) return true;
  if (emergencyCase?.assignedUserId === userId) return true;
  return false;
}

export function insuranceOwnsPaymentFile(
  insuranceCompanyIds: string[] | undefined,
  claimFile?: PaymentFileOwnership | null,
): boolean {
  const companyId = claimFile?.insuranceCompanyId ?? '';
  if (!companyId || !insuranceCompanyIds?.length) return false;
  return insuranceCompanyIds.includes(companyId);
}

export function canViewPaymentRecord(input: {
  roleCode: string | null | undefined;
  userId: string;
  insuranceCompanyIds?: string[];
  claimFile?: PaymentFileOwnership | null;
  emergencyCase?: PaymentEmergencyOwnership | null;
}): boolean {
  if (isPrivilegedPaymentViewer(input.roleCode)) return true;
  if (isOfficeStaffPaymentViewer(input.roleCode)) {
    return officeStaffOwnsPaymentFile(input.userId, input.claimFile, input.emergencyCase);
  }
  if (isFieldStaffPaymentViewer(input.roleCode)) {
    return fieldStaffOwnsPaymentFile(input.userId, input.claimFile, input.emergencyCase);
  }
  if (normalizeRoleCode(input.roleCode) === 'insurance_company_user') {
    return insuranceOwnsPaymentFile(input.insuranceCompanyIds, input.claimFile);
  }
  return true;
}
