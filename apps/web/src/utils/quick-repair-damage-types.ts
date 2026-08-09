import { DAMAGE_TYPE_OPTIONS } from '@/components/damage-reports/RepairItemsModal';
import { formatDisplayLabel } from '@/utils/text-helpers';

/** Dosya konusu / hasar nedeni kodundan hızlı onarım hasar türüne eşleme */
const REASON_CODE_TO_QUICK_TYPE: Record<string, string> = {
  'konut-yangin': 'FIRE_HOME',
  'endustriyel-yangin': 'FIRE_INDUSTRIAL',
  'dahili-su': 'WATER_INTERNAL',
  'su-baskini': 'WATER_INTERNAL',
  'boru-patlamasi': 'WATER_INTERNAL',
  'dogal-afet': 'NATURAL_DISASTER',
  sel: 'NATURAL_DISASTER',
  firtina: 'NATURAL_DISASTER',
  deprem: 'EARTHQUAKE',
  'tasit-carpmasi': 'VEHICLE_IMPACT',
};

const REASON_NAME_TO_QUICK_TYPE: Record<string, string> = {
  'konut yangın': 'FIRE_HOME',
  'endüstriyel yangın': 'FIRE_INDUSTRIAL',
  'su hasarı': 'WATER_INTERNAL',
  'dahili su': 'WATER_INTERNAL',
  'doğal afet': 'NATURAL_DISASTER',
  deprem: 'EARTHQUAKE',
  'taşıt çarpması': 'VEHICLE_IMPACT',
};

function normalizeReasonKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function mapDamageReasonToQuickType(codeOrName: string): string | null {
  const raw = (codeOrName ?? '').trim();
  if (!raw) return null;
  const byCode = REASON_CODE_TO_QUICK_TYPE[raw] ?? REASON_CODE_TO_QUICK_TYPE[normalizeReasonKey(raw)];
  if (byCode) return byCode;
  const byName = REASON_NAME_TO_QUICK_TYPE[normalizeReasonKey(raw)];
  if (byName) return byName;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (DAMAGE_TYPE_OPTIONS.some((opt) => opt.value === upper)) return upper;
  return null;
}

export function inferQuickDamageTypesFromReport(report: {
  damageTypes?: Array<{ damageTypeCode?: string | null; damageTypeName?: string | null }>;
  claimFile?: { lossType?: string | null; claimSubject?: { code?: string | null; name?: string | null } | null } | null;
} | null | undefined): string[] {
  if (!report) return [];
  const mapped = new Set<string>();

  for (const dt of report.damageTypes ?? []) {
    const fromCode = mapDamageReasonToQuickType(dt.damageTypeCode ?? '');
    const fromName = mapDamageReasonToQuickType(dt.damageTypeName ?? '');
    if (fromCode) mapped.add(fromCode);
    if (fromName) mapped.add(fromName);
  }

  const claimSubject = report.claimFile?.claimSubject;
  if (claimSubject?.code) {
    const m = mapDamageReasonToQuickType(claimSubject.code);
    if (m) mapped.add(m);
  }
  if (claimSubject?.name) {
    const m = mapDamageReasonToQuickType(claimSubject.name);
    if (m) mapped.add(m);
  }
  if (report.claimFile?.lossType) {
    const m = mapDamageReasonToQuickType(report.claimFile.lossType);
    if (m) mapped.add(m);
  }

  return Array.from(mapped);
}

export function filterQuickDamageTypeOptions(allowedValues: string[]) {
  if (!allowedValues.length) return DAMAGE_TYPE_OPTIONS;
  return DAMAGE_TYPE_OPTIONS.filter((opt) => allowedValues.includes(opt.value));
}

export type QuickDamageDisplayOption = { value: string; label: string };

/** Hasar türü etiketleri — dosya konusu / hasar nedeni adından; hardcoded enum etiketi kullanılmaz. */
export function buildQuickDamageDisplayOptions(report: {
  damageTypes?: Array<{ damageTypeCode?: string | null; damageTypeName?: string | null }>;
  claimFile?: { lossType?: string | null; claimSubject?: { code?: string | null; name?: string | null } | null } | null;
} | null | undefined): QuickDamageDisplayOption[] {
  if (!report) return [];

  const options = new Map<string, string>();

  const claimSubject = report.claimFile?.claimSubject;
  if (claimSubject?.code || claimSubject?.name) {
    const mapped = mapDamageReasonToQuickType(claimSubject.code ?? claimSubject.name ?? '');
    if (mapped) {
      options.set(mapped, formatDisplayLabel(claimSubject.name ?? claimSubject.code ?? ''));
    }
  }

  for (const dt of report.damageTypes ?? []) {
    const code = mapDamageReasonToQuickType(dt.damageTypeCode ?? '');
    const name = mapDamageReasonToQuickType(dt.damageTypeName ?? '');
    const value = code ?? name;
    if (!value) continue;
    const label = formatDisplayLabel(dt.damageTypeName ?? dt.damageTypeCode ?? '');
    if (label && label !== '—') options.set(value, label);
  }

  if (report.claimFile?.lossType) {
    const mapped = mapDamageReasonToQuickType(report.claimFile.lossType);
    if (mapped && !options.has(mapped)) {
      options.set(mapped, formatDisplayLabel(report.claimFile.lossType));
    }
  }

  const inferred = inferQuickDamageTypesFromReport(report);
  for (const value of inferred) {
    if (!options.has(value)) {
      const enumLabel = DAMAGE_TYPE_OPTIONS.find((opt) => opt.value === value)?.label;
      options.set(value, enumLabel ? formatDisplayLabel(enumLabel) : value);
    }
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

export function quickDamageTypeDisplayLabel(
  value: string,
  labels: Record<string, string>,
): string {
  return labels[value] ?? formatDisplayLabel(value);
}

export const REPORT_IMAGE_CATEGORY_KEYS = ['before', 'damage', 'after'] as const;
export type ReportImageCategoryKey = (typeof REPORT_IMAGE_CATEGORY_KEYS)[number];

/** Rapor görselleri — operasyon dili (Tespit / Onarım / Onarım Sonrası) */
export const REPORT_IMAGE_CATEGORY_LABELS: Record<ReportImageCategoryKey, string> = {
  before: 'Tespit Resimleri',
  damage: 'Onarım Resimleri',
  after: 'Onarım Sonrası Resimleri',
};

export function normalizeReportImageCategory(raw?: string | null): ReportImageCategoryKey {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'before' || v === 'tespit') return 'before';
  if (v === 'damage' || v === 'onarım' || v === 'onarim') return 'damage';
  if (v === 'after' || v === 'onarım sonrası' || v === 'onarim sonrasi' || v === 'sonrası' || v === 'sonrasi') {
    return 'after';
  }
  if (REPORT_IMAGE_CATEGORY_KEYS.includes(v as ReportImageCategoryKey)) {
    return v as ReportImageCategoryKey;
  }
  return 'damage';
}

export function reportImageCategoryLabel(category?: string | null): string {
  const key = normalizeReportImageCategory(category);
  return REPORT_IMAGE_CATEGORY_LABELS[key];
}
