import {
  OPERATION_REFERENCE_POOL,
  type OperationReferenceRecord,
} from '@/data/operation-reference-operations';
import type {
  ReferenceFilters,
  ReferenceKpiStats,
  ReferenceMapPin,
  ReferenceOperationCategory,
} from '@/components/portal/operation-reference.types';

function normalizeCityKey(city: string): string {
  return city
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function resolveInstitutionDisplay(
  record: OperationReferenceRecord,
  canViewInstitution: boolean,
): string {
  if (canViewInstitution && record.institutionName) return record.institutionName;
  return record.institutionFallback;
}

export function referenceToMapPin(
  record: OperationReferenceRecord,
  canViewInstitution: boolean,
): ReferenceMapPin {
  const institutionDisplay = resolveInstitutionDisplay(record, canViewInstitution);
  return {
    id: record.id,
    latitude: record.latitude,
    longitude: record.longitude,
    label: institutionDisplay,
    tooltip: institutionDisplay,
    category: record.category,
    city: record.city,
    district: record.district,
    institutionDisplay,
    operationType: record.operationType,
    categoryLabel: record.categoryLabel,
    dateLabel: record.dateLabel,
    status: record.status,
    statusTone: record.statusTone,
  };
}

export function computeReferenceKpis(records: OperationReferenceRecord[]): ReferenceKpiStats {
  const stats: ReferenceKpiStats = {
    residential: 0,
    industrial: 0,
    public_critical: 0,
    maritime: 0,
    disaster: 0,
    servedProvinces: 0,
  };

  const provinces = new Set<string>();

  records.forEach((record) => {
    if (record.category !== 'social') {
      stats[record.category] += record.volumeCount;
    }
    if (record.city !== 'Türkiye Geneli') {
      provinces.add(normalizeCityKey(record.city));
    }
  });

  stats.servedProvinces = Math.max(provinces.size, 1);
  return stats;
}

export function getReferenceCityOptions(records: OperationReferenceRecord[]): string[] {
  const cities = new Set<string>();
  records.forEach((record) => {
    if (record.city !== 'Türkiye Geneli') cities.add(record.city);
  });
  return Array.from(cities).sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

export function filterReferenceOperations(
  records: OperationReferenceRecord[],
  filters: ReferenceFilters,
): OperationReferenceRecord[] {
  return records.filter((record) => {
    if (filters.category !== 'all' && record.category !== filters.category) return false;

    if (filters.city !== 'all' && record.city !== filters.city && record.city !== 'Türkiye Geneli') {
      return false;
    }

    if (filters.dateFrom && record.dateIso < filters.dateFrom) return false;
    if (filters.dateTo && record.dateIso > filters.dateTo) return false;

    return true;
  });
}

export function buildReferenceMapPins(
  records: OperationReferenceRecord[],
  canViewInstitution: boolean,
): ReferenceMapPin[] {
  return records.map((record) => referenceToMapPin(record, canViewInstitution));
}

export function getFeaturedReferenceOperations(
  records: OperationReferenceRecord[],
): OperationReferenceRecord[] {
  return records
    .filter((record) => record.featured)
    .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99));
}

export function formatReferenceKpiValue(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value);
}

export function referenceCategoryColor(category: ReferenceOperationCategory): string {
  const colors: Record<ReferenceOperationCategory, string> = {
    residential: '#2563EB',
    industrial: '#16A34A',
    public_critical: '#7C3AED',
    maritime: '#0891B2',
    disaster: '#EA580C',
    social: '#DC2626',
  };
  return colors[category];
}

export function getDefaultReferenceFilters(): ReferenceFilters {
  return {
    category: 'all',
    city: 'all',
    dateFrom: '',
    dateTo: '',
  };
}

export { OPERATION_REFERENCE_POOL };
