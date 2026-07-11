import { DAMAGE_TYPE_OPTIONS } from '@/components/damage-reports/RepairItemsModal';

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

export const REPORT_IMAGE_CATEGORY_LABELS: Record<string, string> = {
  before: 'Tespit',
  damage: 'Onarım',
  after: 'Onarım Sonrası',
};
