export type AssistantScopeEntry = string | { id?: string; name?: string };

export function resolveAssistantCustomerIds(
  scopes: AssistantScopeEntry[] | undefined | null,
): string[] {
  if (!scopes?.length) return [];
  return scopes
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter((id): id is string => Boolean(id));
}

export function resolveAssistantCustomerNames(
  scopes: AssistantScopeEntry[] | undefined | null,
): string[] {
  if (!scopes?.length) return [];
  return scopes
    .map((entry) => (typeof entry === 'string' ? undefined : entry?.name))
    .filter((name): name is string => Boolean(name));
}

export function hasAssistanceCompanyUserAccess(user: { role?: { code?: string } } | null): boolean {
  return user?.role?.code === 'assistance_company_user';
}

export function readAssistancePortalUser(): {
  user: Record<string, unknown> | null;
  customerIds: string[];
  customerNames: string[];
  hasScope: boolean;
} {
  if (typeof window === 'undefined') {
    return { user: null, customerIds: [], customerNames: [], hasScope: false };
  }
  const raw = localStorage.getItem('user');
  if (!raw) return { user: null, customerIds: [], customerNames: [], hasScope: false };
  try {
    const user = JSON.parse(raw) as Record<string, unknown>;
    const scopes = user.assistantCustomerScopes as AssistantScopeEntry[] | undefined;
    const customerIds = resolveAssistantCustomerIds(scopes);
    const customerNames = resolveAssistantCustomerNames(scopes);
    return { user, customerIds, customerNames, hasScope: customerIds.length > 0 };
  } catch {
    return { user: null, customerIds: [], customerNames: [], hasScope: false };
  }
}
