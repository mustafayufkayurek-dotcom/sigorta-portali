/** Yeni dosya hizmet türü — Hasar Tespit / Onarım / Danışmanlık */

export const CLAIM_SERVICE_KINDS = ['inspection', 'repair', 'consultancy'] as const;
export type ClaimServiceKind = (typeof CLAIM_SERVICE_KINDS)[number];

export const CLAIM_SERVICE_KIND_LABEL: Record<ClaimServiceKind, string> = {
  inspection: 'Hasar Tespit',
  repair: 'Hasar Onarım Ve Restorasyon',
  consultancy: 'Danışmanlık',
};

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

export function departmentCodeForNewClaim(input: {
  customerSource: 'expert' | 'private';
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
