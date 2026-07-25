export type ReferenceOperationCategory =
  | 'residential'
  | 'industrial'
  | 'public_critical'
  | 'maritime'
  | 'disaster'
  | 'social';

export type ReferenceMapPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tooltip: string;
  category: ReferenceOperationCategory;
  city: string;
  district?: string;
  institutionDisplay: string;
  operationType: string;
  categoryLabel: string;
  dateLabel: string;
  status: string;
  statusTone: 'success' | 'neutral';
};

export type ReferenceKpiKey =
  | 'residential'
  | 'industrial'
  | 'public_critical'
  | 'maritime'
  | 'disaster'
  | 'servedProvinces';

export type ReferenceKpiStats = Record<ReferenceKpiKey, number>;

export type ReferenceFilters = {
  category: ReferenceOperationCategory | 'all';
  city: string;
  dateFrom: string;
  dateTo: string;
};

export const REFERENCE_CATEGORY_META: Record<
  ReferenceOperationCategory,
  { label: string; shortLabel: string; color: string; kpiLabel: string }
> = {
  residential: {
    label: 'Konut Operasyonları',
    shortLabel: 'Konut',
    color: '#2563EB',
    kpiLabel: 'Konut Operasyonları',
  },
  industrial: {
    label: 'Endüstriyel Operasyonlar',
    shortLabel: 'Endüstriyel',
    color: '#16A34A',
    kpiLabel: 'Endüstriyel Operasyonlar',
  },
  public_critical: {
    label: 'Kamu / Kritik Altyapı',
    shortLabel: 'Kamu / Kritik Altyapı',
    color: '#7C3AED',
    kpiLabel: 'Kamu / Kritik Altyapı',
  },
  maritime: {
    label: 'Denizcilik Operasyonları',
    shortLabel: 'Denizcilik',
    color: '#0891B2',
    kpiLabel: 'Denizcilik Operasyonları',
  },
  disaster: {
    label: 'Afet Operasyonları',
    shortLabel: 'Afet',
    color: '#EA580C',
    kpiLabel: 'Afet Operasyonları',
  },
  social: {
    label: 'Toplumsal Olay Operasyonları',
    shortLabel: 'Toplumsal Olay Operasyonları',
    color: '#DC2626',
    kpiLabel: 'Toplumsal Olay Operasyonları',
  },
};

export const REFERENCE_KPI_CARDS: {
  key: ReferenceKpiKey;
  label: string;
  icon: ReferenceOperationCategory | 'servedProvinces';
}[] = [
  { key: 'residential', label: 'Konut Operasyonları', icon: 'residential' },
  { key: 'industrial', label: 'Endüstriyel Operasyonlar', icon: 'industrial' },
  { key: 'public_critical', label: 'Kamu / Kritik Altyapı', icon: 'public_critical' },
  { key: 'maritime', label: 'Denizcilik Operasyonları', icon: 'maritime' },
  { key: 'disaster', label: 'Afet Operasyonları', icon: 'disaster' },
  { key: 'servedProvinces', label: 'Hizmet Verilen İl', icon: 'servedProvinces' },
];
