import {
  operationAreaFromDepartmentCodes,
  type OperationAreaCode,
} from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole } from '@/hooks/usePanelRole';

export type PanelUserLike = {
  role?: { code?: string | null } | null;
  departmentMemberships?: Array<{ department?: { code?: string | null } | null }> | null;
  operationalAccessGrants?: Array<{
    scopeType?: string;
    grantType?: string;
    accessLevel?: string;
    validFrom?: string;
    validTo?: string | null;
    principalUserId?: string | null;
  }> | null;
};

export type OperationalAccessGrantSummary = NonNullable<PanelUserLike['operationalAccessGrants']>[number];

export function hasActiveFunctionDelegation(
  grants: OperationalAccessGrantSummary[] | null | undefined,
  scopeType: 'acil_yardim' | 'hasar',
): boolean {
  if (!grants?.length) return false;
  const now = Date.now();
  return grants.some((grant) => {
    if (grant.grantType !== 'function_delegation') return false;
    const scope = grant.scopeType ?? '';
    const scopeOk = scope === scopeType || scope === 'both';
    if (!scopeOk) return false;
    const from = grant.validFrom ? new Date(grant.validFrom).getTime() : 0;
    const to = grant.validTo ? new Date(grant.validTo).getTime() : null;
    if (from > now) return false;
    if (to !== null && to < now) return false;
    return true;
  });
}

export function userOperationArea(user: PanelUserLike | null | undefined): OperationAreaCode {
  const codes = (user?.departmentMemberships ?? []).map((item) => item?.department?.code ?? undefined);
  return operationAreaFromDepartmentCodes(codes);
}

/** Hasar-only saha/ofis personeli acil yardım modülünü görmemeli */
export function canAccessAcilYardim(
  roleCode: string,
  operationArea: OperationAreaCode,
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
): boolean {
  const role = String(roleCode ?? '').trim().toLowerCase();
  if (role === 'admin' || role === 'manager') return true;
  if (isFinanceRole(role)) {
    return hasActiveFunctionDelegation(operationalAccessGrants, 'acil_yardim');
  }
  if (isFieldStaffRole(role) || isOfficeStaffRole(role)) {
    return operationArea === 'acil' || operationArea === 'both';
  }
  return false;
}

function isAcilYardimDetailPath(pathname: string): boolean {
  if (!pathname.startsWith('/panel/acil-yardim/')) return false;
  if (pathname === '/panel/acil-yardim/finans' || pathname.startsWith('/panel/acil-yardim/finans/')) {
    return false;
  }
  return true;
}

function isAcilYardimFinansPath(pathname: string): boolean {
  return pathname === '/panel/acil-yardim/finans' || pathname.startsWith('/panel/acil-yardim/finans/');
}

/** Hasar departmanlı ofis personeli: operasyon / gelen kutusu akışı için sınırlı acil erişim */
function officeStaffCanAccessAcilOperationally(
  roleCode: string,
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
  allowedScreens?: string[] | null,
): boolean {
  if (!isOfficeStaffRole(roleCode)) return false;
  if (allowedScreens?.includes('operasyon') || allowedScreens?.includes('acil_yardim')) {
    return true;
  }
  return hasActiveFunctionDelegation(operationalAccessGrants, 'acil_yardim');
}

/**
 * Acil yardım liste sayfası departman kapsamına bağlı;
 * dosya detayı gelen kutusu / atanan dosya için operasyon yetkisi olan dosya sorumlusuna açılır.
 */
export function canAccessAcilYardimRoute(
  pathname: string,
  roleCode: string,
  operationArea: OperationAreaCode,
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
  allowedScreens?: string[] | null,
): boolean {
  if (canAccessAcilYardim(roleCode, operationArea, operationalAccessGrants)) {
    return true;
  }

  if (isAcilYardimFinansPath(pathname)) {
    return false;
  }

  if (pathname === '/panel/acil-yardim' || isAcilYardimDetailPath(pathname)) {
    if (officeStaffCanAccessAcilOperationally(roleCode, operationalAccessGrants, allowedScreens)) {
      return true;
    }
  }

  const role = String(roleCode ?? '').trim().toLowerCase();
  if (isFinanceRole(role) && hasActiveFunctionDelegation(operationalAccessGrants, 'acil_yardim')) {
    return true;
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
