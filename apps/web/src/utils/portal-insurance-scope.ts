export type InsuranceScopeEntry = string | { id?: string; name?: string };

export function resolveInsuranceCompanyIds(
  scopes: InsuranceScopeEntry[] | undefined | null,
): string[] {
  if (!scopes?.length) return [];
  return scopes
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter((id): id is string => Boolean(id));
}

export function resolveInsuranceCompanyNames(
  scopes: InsuranceScopeEntry[] | undefined | null,
): string[] {
  if (!scopes?.length) return [];
  return scopes
    .map((entry) => (typeof entry === 'string' ? undefined : entry?.name))
    .filter((name): name is string => Boolean(name));
}

export function hasInsuranceCompanyUserAccess(user: { role?: { code?: string } } | null): boolean {
  return user?.role?.code === 'insurance_company_user';
}

export function readInsurancePortalUser(): {
  user: Record<string, unknown> | null;
  companyIds: string[];
  companyNames: string[];
  hasScope: boolean;
} {
  if (typeof window === 'undefined') {
    return { user: null, companyIds: [], companyNames: [], hasScope: false };
  }
  const raw = localStorage.getItem('user');
  if (!raw) return { user: null, companyIds: [], companyNames: [], hasScope: false };
  try {
    const user = JSON.parse(raw) as Record<string, unknown>;
    const scopes = user.insuranceCompanyScopes as InsuranceScopeEntry[] | undefined;
    const companyIds = resolveInsuranceCompanyIds(scopes);
    const companyNames = resolveInsuranceCompanyNames(scopes);
    return { user, companyIds, companyNames, hasScope: companyIds.length > 0 };
  } catch {
    return { user: null, companyIds: [], companyNames: [], hasScope: false };
  }
}
