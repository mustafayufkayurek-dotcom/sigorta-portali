export const MERIDYEN_SCOPE = 'meridyen';
export const VENDOR_SCOPE = 'vendor';
const LEGACY_CUSTOMER_SCOPE = 'customer';

/** API/DB scope normalizasyonu — eski customer değerini Meridyen kapsamına çevirir */
export function normalizeServiceBranchScope(scope?: string | null): string | undefined {
  if (!scope) return undefined;
  if (scope === LEGACY_CUSTOMER_SCOPE) return MERIDYEN_SCOPE;
  return scope;
}

export function resolveCreateScope(scope?: string | null): string {
  return normalizeServiceBranchScope(scope) ?? MERIDYEN_SCOPE;
}

export function meridyenScopeFilter() {
  return { scope: { in: [MERIDYEN_SCOPE, LEGACY_CUSTOMER_SCOPE] } };
}
