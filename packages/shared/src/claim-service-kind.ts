/** Yeni dosya hizmet türü — üç seçenek aşağı açılır; Danışmanlık listesi sol menüdedir */

export const CLAIM_SERVICE_KINDS = ['inspection', 'repair', 'consultancy'] as const;
export type ClaimServiceKind = (typeof CLAIM_SERVICE_KINDS)[number];

/** Eski üst seçim — menü gruplaması; Yeni Dosya üç hizmet seçeneğidir */
export const CLAIM_FILE_SERVICE_KIND_TOP = ['repair', 'consultancy'] as const;
export type ClaimFileServiceKindTop = (typeof CLAIM_FILE_SERVICE_KIND_TOP)[number];

export const HASAR_LIST_HIZMET_PARAM = 'hizmet';
export const HASAR_HIZMET_DANISMANLIK = 'danismanlik';
export const HASAR_HIZMET_TESPIT = 'hasar-tespit';

export const CLAIM_SERVICE_KIND_LABEL: Record<ClaimServiceKind, string> = {
  inspection: 'Hasar Tespit',
  repair: 'Hasar Onarım Ve Restorasyon',
  consultancy: 'Danışmanlık',
};

export const CONSULTANCY_SERVICE_FAMILY = 'consultancy';
export const HASAR_TESPIT_SERVICE_CODE = 'hasar_tespit';
export const HASAR_TESPIT_SERVICE_NAME = 'Hasar Tespit';

export const INSPECTOR_ALREADY_ASSIGNED_MESSAGE = 'Bu tespitçi bu dosyaya zaten atanmış.';

export const SITE_CONTACT_NOT_ON_REPORT = true;

const INSPECTION_HIDDEN_STEPS = new Set([
  'supplier',
  'approved',
  'digital_approval',
  'repair_whatsapp',
  'repair_complete',
  'muvafakat',
]);

export function parseClaimServiceKind(raw: unknown): ClaimServiceKind {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'inspection' || v === 'hasar_tespit' || v === 'hasar-tespit' || v === 'tespit') return 'inspection';
  if (v === 'consultancy' || v === 'danismanlik' || v === 'danışmanlık') return 'consultancy';
  return 'repair';
}

export function claimServiceKindFromListHizmet(raw: unknown): ClaimServiceKind {
  const h = normalizeHasarListHizmet(raw);
  if (!h) return 'repair';
  if (h === HASAR_HIZMET_TESPIT) return 'inspection';
  if (h === HASAR_HIZMET_DANISMANLIK) return 'consultancy';
  if (h === 'repair' || h === 'onarim' || h === 'hasar-onarim') return 'repair';
  return 'consultancy';
}

export function newClaimOpeningCaption(kind: ClaimServiceKind): string {
  if (kind === 'inspection') return 'Hasar Tespit Dosyası Açılıyor';
  if (kind === 'consultancy') return 'Danışmanlık Dosyası Açılıyor';
  return 'Hasar Dosyası Açılıyor';
}

export function isInspectionServiceKind(raw: unknown): boolean {
  return parseClaimServiceKind(raw) === 'inspection';
}

export type HasarTespitClaimHint = {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
};

/** Danışmanlık menüsündeki Hasar Tespit ile ayrı tuştaki tespit aynı iştir. */
export function isHasarTespitClaim(input?: HasarTespitClaimHint | null): boolean {
  if (!input) return false;
  if (isInspectionServiceKind(input.serviceKind)) return true;
  return isHasarTespitConsultancyType(input.consultancyServiceType ?? {});
}

/** Hasar Tespit raporunda iş kalemi ve tutar zorunlu değildir. */
export function repairReportRequiresPricedItems(
  serviceKind: unknown,
  consultancyType?: { code?: string | null; name?: string | null } | null,
): boolean {
  return !isHasarTespitClaim({ serviceKind, consultancyServiceType: consultancyType });
}

export function hasarReportDocumentTitle(
  serviceKind?: unknown,
  consultancyType?: { code?: string | null; name?: string | null } | null,
): string {
  return isHasarTespitClaim({ serviceKind, consultancyServiceType: consultancyType })
    ? 'Hasar Tespit Raporu'
    : 'Hasar Onarım Raporu';
}

export function plannerStepHiddenForServiceKind(
  stepId: string,
  serviceKind: unknown,
  consultancyType?: { code?: string | null; name?: string | null } | null,
): boolean {
  if (!isHasarTespitClaim({ serviceKind, consultancyServiceType: consultancyType })) return false;
  return INSPECTION_HIDDEN_STEPS.has(stepId);
}

export function isHasarTespitConsultancyType(row: {
  code?: string | null;
  name?: string | null;
}): boolean {
  const code = String(row.code ?? '').trim().toLowerCase();
  if (code === HASAR_TESPIT_SERVICE_CODE || code === 'inspection' || code === 'tespit') return true;
  const name = String(row.name ?? '').trim().toLocaleLowerCase('tr-TR');
  return name === 'hasar tespit';
}

export function normalizeHasarListHizmet(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (v === 'inspection' || v === HASAR_TESPIT_SERVICE_CODE.replace(/_/g, '-')) return HASAR_HIZMET_TESPIT;
  if (v === 'consultancy') return HASAR_HIZMET_DANISMANLIK;
  return v;
}

export const MUSTERI_KAYNAK_ASISTANS = 'asistans';
export const ASISTANS_CUSTOMER_SUB_TYPES = ['asistan_firmasi', 'asistans_firmasi'] as const;

export function normalizeMusteriKaynak(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (v === 'asistans' || v === 'asistan' || v === 'asistan-firmasi' || v === 'asistans-firmasi') {
    return MUSTERI_KAYNAK_ASISTANS;
  }
  return v;
}

export function claimFileWhereForMusteriKaynak(raw: unknown): Record<string, unknown> | null {
  const k = normalizeMusteriKaynak(raw);
  if (k !== MUSTERI_KAYNAK_ASISTANS) return null;
  return { customer: { subType: { in: [...ASISTANS_CUSTOMER_SUB_TYPES] } } };
}

export function claimFileWhereForHizmet(raw: unknown): Record<string, unknown> | null {
  const h = normalizeHasarListHizmet(raw);
  if (!h) return null;
  if (h === HASAR_HIZMET_TESPIT) return { serviceKind: 'inspection' };
  if (h === HASAR_HIZMET_DANISMANLIK) return { serviceKind: 'consultancy' };
  if (h === 'repair' || h === 'onarim' || h === 'hasar-onarim') return { serviceKind: 'repair' };
  const underscored = h.replace(/-/g, '_');
  return {
    serviceKind: 'consultancy',
    consultancyServiceType: { code: { in: [h, underscored] } },
  };
}

export function claimServiceKindFromConsultancyType(row: {
  code?: string | null;
  name?: string | null;
} | null | undefined): ClaimServiceKind {
  if (!row) return 'consultancy';
  return isHasarTespitConsultancyType(row) ? 'inspection' : 'consultancy';
}

export function departmentCodeForNewClaim(input: {
  customerSource: 'expert' | 'private' | 'broker' | 'insurance';
  serviceKind: ClaimServiceKind;
}): string {
  if (input.serviceKind === 'consultancy') return 'danismanlik';
  if (input.customerSource === 'private') return 'ozel-musteri';
  return 'hasar-onarim';
}

export function isInspectorAlreadyAssigned(inspectorId: string | null | undefined, assignedId: string | null | undefined): boolean {
  const a = String(inspectorId ?? '').trim();
  const b = String(assignedId ?? '').trim();
  return Boolean(a && b && a === b);
}

export type ConsultancyTypeListRow = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

function asObject(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export function parseServiceTypeListPayload(raw: unknown): ConsultancyTypeListRow[] {
  const root = asObject(raw);
  const nested = root ? asObject(root.data) : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(nested?.data)
        ? nested.data
        : [];
  const out: ConsultancyTypeListRow[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { id?: unknown; name?: unknown; code?: unknown; isActive?: unknown };
    const id = String(r.id ?? '').trim();
    const name = String(r.name ?? '').trim();
    if (!id || !name) continue;
    out.push({
      id,
      name,
      code: r.code == null ? null : String(r.code),
      isActive: r.isActive !== false,
    });
  }
  return out;
}

/** Yeni Dosya Danışmanlık listesi — Hasar Tespit ayrı tuştadır */
export function consultancyTypesForNewFile(rows: ConsultancyTypeListRow[]): ConsultancyTypeListRow[] {
  return rows.filter((row) => row.isActive !== false && !isHasarTespitConsultancyType(row));
}
