/** Ayarlar Sigorta Şirketleri ile Hasar dosya listesi aynı katalogdur. */

export const INSURANCE_COMPANY_CATALOG_LIMIT = 1000;
/** Ayarlar kaydı — ofis formları aynı üst sınırı kullanır. */
export const OFFICE_SETTINGS_CATALOG_LIMIT = INSURANCE_COMPANY_CATALOG_LIMIT;

export const HASAR_FILE_INSURANCE_CATALOG_QUERY = {
  status: 'active' as const,
  limit: INSURANCE_COMPANY_CATALOG_LIMIT,
};

export const SETTINGS_INSURANCE_CATALOG_QUERY = {
  status: 'all' as const,
  limit: INSURANCE_COMPANY_CATALOG_LIMIT,
};

export function clampInsuranceCompanyListLimit(limit?: number | string | null): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.trunc(n), INSURANCE_COMPANY_CATALOG_LIMIT);
}

/** `status=all` pasifleri de getirir. Boş veya yok → yalnız aktif. */
export function insuranceCompanyListWhere(status?: string | null): { status?: string } {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'all') return {};
  if (s) return { status: s };
  return { status: 'active' };
}

function normalizeRoleCode(roleCode: string | null | undefined): string {
  return String(roleCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

export function insuranceScopeIds(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && 'id' in entry) {
        return String((entry as { id?: unknown }).id ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

/**
 * Sigorta portal kullanıcısı yalnız kendi şirketini görür.
 * Dosya sorumlusu (ofis) Ayarlar kaydını görür; kişisel kapsam yeni şirketi gizlemez.
 */
export function shouldRestrictHasarInsuranceCatalogByUserScopes(roleCode: string | null | undefined): boolean {
  return normalizeRoleCode(roleCode) === 'insurance_company_user';
}

export function filterInsuranceCatalogForHasarFileForm<T extends { id: string }>(
  companies: T[],
  roleCode: string | null | undefined,
  scopes: unknown,
): T[] {
  if (!shouldRestrictHasarInsuranceCatalogByUserScopes(roleCode)) return companies;
  const ids = insuranceScopeIds(scopes);
  if (ids.length === 0) return companies;
  return companies.filter((company) => ids.includes(company.id));
}
