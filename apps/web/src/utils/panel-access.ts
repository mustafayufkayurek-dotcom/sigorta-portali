import {
  operationAreaFromDepartmentCodes,
  type OperationAreaCode,
} from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole } from '@/hooks/usePanelRole';

export type PanelUserLike = {
  role?: { code?: string | null } | null;
  departmentMemberships?: Array<{ department?: { code?: string | null } | null }> | null;
};

export function userOperationArea(user: PanelUserLike | null | undefined): OperationAreaCode {
  const codes = (user?.departmentMemberships ?? []).map((item) => item?.department?.code ?? undefined);
  return operationAreaFromDepartmentCodes(codes);
}

/** Hasar-only saha/ofis personeli acil yardım modülünü görmemeli */
export function canAccessAcilYardim(roleCode: string, operationArea: OperationAreaCode): boolean {
  const role = String(roleCode ?? '').trim().toLowerCase();
  if (role === 'admin' || role === 'manager') return true;
  if (isFinanceRole(role)) return false;
  if (isFieldStaffRole(role) || isOfficeStaffRole(role)) {
    return operationArea === 'acil' || operationArea === 'both';
  }
  return false;
}

export function panelShowsFinanceWidgets(roleCode: string): boolean {
  const role = String(roleCode ?? '').trim().toLowerCase();
  if (isFieldStaffRole(role) || isOfficeStaffRole(role) || isFinanceRole(role)) return false;
  return true;
}

export function readStoredPanelUser(): PanelUserLike | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as PanelUserLike;
  } catch {
    return null;
  }
}
