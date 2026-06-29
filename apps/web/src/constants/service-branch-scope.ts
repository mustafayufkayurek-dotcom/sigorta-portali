/** service_branches.scope — Ayarlar ve formlarda kullanılan kapsam sabitleri */
export const MERIDYEN_SERVICE_BRANCH_SCOPE = 'meridyen';
export const VENDOR_SERVICE_BRANCH_SCOPE = 'vendor';

/** Eski API/DB değeri — geriye dönük okuma */
export const LEGACY_CUSTOMER_SCOPE = 'customer';

export function isMeridyenScope(scope?: string | null): boolean {
  return scope === MERIDYEN_SERVICE_BRANCH_SCOPE || scope === LEGACY_CUSTOMER_SCOPE;
}
