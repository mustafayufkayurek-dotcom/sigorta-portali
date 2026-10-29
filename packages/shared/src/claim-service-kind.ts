/** Yeni dosya hizmet türü — üç tuş durur; Danışmanlık listesi sol menüdedir */

export const CLAIM_SERVICE_KINDS = ['inspection', 'repair', 'consultancy'] as const;
export type ClaimServiceKind = (typeof CLAIM_SERVICE_KINDS)[number];

/** Eski üst seçim — menü gruplaması; Yeni Dosya üç tuştur */
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
  if (v === 'inspection' || v === 'hasar_tespit' || v === 'tespit') return 'inspection';
  if (v === 'consultancy' || v === 'danismanlik' || v === 'danışmanlık') return 'consultancy';
  return 'repair';
}

export function isInspectionServiceKind(raw: unknown): boolean {
  return parseClaimServiceKind(raw) === 'inspection';
}

export function plannerStepHiddenForServiceKind(stepId: string, serviceKind: unknown): boolean {
  if (!isInspectionServiceKind(serviceKind)) return false;
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
  if (h === HASAR_HIZMET_DANISMANLIK) {
    return { serviceKind: { in: ['inspection', 'consultancy'] } };
  }
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
  customerSource: 'expert' | 'private';
  serviceKind: ClaimServiceKind;
}): string {
  if (input.serviceKind === 'consultancy') return 'danismanlik';
  if (input.customerSource === 'private') return 'ozel-musteri';
  if (input.serviceKind === 'inspection') return 'danismanlik';
  return 'hasar-onarim';
}

export function isInspectorAlreadyAssigned(inspectorId: string | null | undefined, assignedId: string | null | undefined): boolean {
  const a = String(inspectorId ?? '').trim();
  const b = String(assignedId ?? '').trim();
  return Boolean(a && b && a === b);
}
