import {
  operationAreaFromDepartmentCodes,
  type OperationAreaCode,
} from '../app/panel/kullanicilar/_lib/user-invite-config';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole, roleAllowedForNav } from '../hooks/usePanelRole';
import panelRouteAccessRules from './panel-route-access.rules.json';

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

function normalizeRoleCode(roleCode: string): string {
  return String(roleCode ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

export function isPortalRole(roleCode: string): boolean {
  const role = normalizeRoleCode(roleCode);
  return role === 'expert' || role === 'insurance_company_user' || role === 'assistance_company_user';
}

/** Portal deep-link / refresh: yalnızca kendi portal ağacı + profil (+ /panel ana yönlendirme) */
export function portalAllowsPath(roleCode: string, pathname: string): boolean {
  if (pathname === '/panel/profil' || pathname.startsWith('/panel/profil/')) return true;
  // Ana panel: layout home redirect’i için açık (sert deny yok)
  if (pathname === '/panel') return true;

  const role = normalizeRoleCode(roleCode);
  if (role === 'expert') {
    return pathname === '/panel/eksper-portal' || pathname.startsWith('/panel/eksper-portal/');
  }
  if (role === 'insurance_company_user') {
    return pathname === '/panel/sigorta-portal' || pathname.startsWith('/panel/sigorta-portal/');
  }
  if (role === 'assistance_company_user') {
    return pathname === '/panel/asistans-portal' || pathname.startsWith('/panel/asistans-portal/');
  }
  return false;
}

export function getSafePanelHomePath(roleCode: string): string {
  const role = normalizeRoleCode(roleCode);
  if (role === 'expert') return '/panel/eksper-portal';
  if (role === 'insurance_company_user') return '/panel/sigorta-portal';
  if (role === 'assistance_company_user') return '/panel/asistans-portal';
  if (isFinanceRole(role)) return '/panel/finans';
  return '/panel';
}

/** Giriş / yanlış kapı: her rol kendi ana sayfasına gider (portal, finans, diğerleri). */
export function getLoginHomePath(roleCode: string): string {
  return getSafePanelHomePath(roleCode);
}

/**
 * Panel route kuralları (en uzun path kazanır).
 * Tek kaynak: panel-route-access.rules.json (smoke ile paylaşılır).
 * `/panel` yalnızca exact eşleşir — alt path’leri gölgelemez.
 * roles: [] = oturum açmış panel personeli (portal hariç; portal ayrı allowlist).
 */
export const PANEL_ROUTE_ACCESS: ReadonlyArray<{ path: string; roles: readonly string[] }> =
  panelRouteAccessRules as ReadonlyArray<{ path: string; roles: readonly string[] }>;

function routeRuleMatchesPath(pathname: string, rulePath: string): boolean {
  if (pathname === rulePath) return true;
  // Dashboard catch-all deliğini kapat: /panel altındaki her şey ayrı kural ister
  if (rulePath === '/panel') return false;
  return pathname.startsWith(`${rulePath}/`);
}

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

/**
 * Acil finans sayfası (`/panel/acil-yardim/finans`) ve «Finans sayfasını aç».
 * Dosya sorumlusu menüsünde bu sayfa yoktur; ödeme kaydı dosyadan görülür.
 * Açık: admin, veya Acil Yardım dosya sorumluluğuna vekalet eden finans personeli.
 */
export function canOpenAcilFinancePage(
  roleCode: string,
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
): boolean {
  const role = String(roleCode ?? '').trim().toLowerCase();
  if (role === 'admin') return true;
  if (isFinanceRole(role) && hasActiveFunctionDelegation(operationalAccessGrants, 'acil_yardim')) {
    return true;
  }
  return false;
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

function stripPathQueryHash(pathname: string): string {
  return String(pathname ?? '').split(/[?#]/)[0];
}

function isAcilYardimDetailPath(pathname: string): boolean {
  const path = stripPathQueryHash(pathname);
  if (!path.startsWith('/panel/acil-yardim/')) return false;
  if (path === '/panel/acil-yardim/finans' || path.startsWith('/panel/acil-yardim/finans/')) {
    return false;
  }
  return true;
}

function isAcilYardimFinansPath(pathname: string): boolean {
  const path = stripPathQueryHash(pathname);
  return path === '/panel/acil-yardim/finans' || path.startsWith('/panel/acil-yardim/finans/');
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
  if (isAcilYardimFinansPath(pathname)) {
    return canOpenAcilFinancePage(roleCode, operationalAccessGrants);
  }

  if (canAccessAcilYardim(roleCode, operationArea, operationalAccessGrants)) {
    return true;
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

/**
 * Frontend route gate (Dalga 1).
 * API yetkilendirmesinin yerine geçmez; yalnızca UI erişimini sınırlar.
 * Eşleşmeyen path → deny. Portal → allowlist. /panel → exact only.
 */
export function hasPanelRouteAccess(
  pathname: string,
  roleCode: string,
  operationArea: OperationAreaCode = '',
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
  allowedScreens?: string[] | null,
): boolean {
  if (!pathname || !roleCode) return false;

  if (pathname === '/panel/profil' || pathname.startsWith('/panel/profil/')) {
    return true;
  }

  if (isPortalRole(roleCode)) {
    return portalAllowsPath(roleCode, pathname);
  }

  if (pathname === '/panel/acil-yardim' || pathname.startsWith('/panel/acil-yardim/')) {
    return canAccessAcilYardimRoute(pathname, roleCode, operationArea, operationalAccessGrants, allowedScreens);
  }

  const matching = PANEL_ROUTE_ACCESS
    .filter((rule) => routeRuleMatchesPath(pathname, rule.path))
    .sort((a, b) => b.path.length - a.path.length);

  if (matching.length === 0) return false;

  const rule = matching[0];
  if (rule.roles.length === 0) return true;
  return roleAllowedForNav(roleCode, [...rule.roles]);
}

/** @deprecated Eski ad — hasPanelRouteAccess kullanın */
export function hasRouteAccess(
  pathname: string,
  roleCode: string,
  operationArea: OperationAreaCode = '',
  operationalAccessGrants?: OperationalAccessGrantSummary[] | null,
  allowedScreens?: string[] | null,
): boolean {
  return hasPanelRouteAccess(pathname, roleCode, operationArea, operationalAccessGrants, allowedScreens);
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
