/** AI + AR Akıllı Ölçüm — yapı elemanı tipleri (genişletilebilir) */

export const SMART_MEASURE_ELEMENT_TYPES = [
  'kapi',
  'pencere',
  'mutfak_dolabi',
  'banyo_dolabi',
  'tezgah',
  'duvar',
  'cam',
  'seramik',
  'fayans',
  'parke',
  'tavan',
  'kolon',
  'kiris',
  'lavabo',
  'klozet',
  'dusakabin',
  'klima',
  'radyator',
  'merdiven',
  'asma_tavan',
  'pvc_dograma',
  'ahsap_dograma',
  'diger',
] as const;

export type SmartMeasureElementType = (typeof SMART_MEASURE_ELEMENT_TYPES)[number];

export const SMART_MEASURE_ELEMENT_TYPE_LABELS: Record<SmartMeasureElementType, string> = {
  kapi: 'Kapı',
  pencere: 'Pencere',
  mutfak_dolabi: 'Mutfak Dolabı',
  banyo_dolabi: 'Banyo Dolabı',
  tezgah: 'Tezgâh',
  duvar: 'Duvar',
  cam: 'Cam',
  seramik: 'Seramik',
  fayans: 'Fayans',
  parke: 'Parke',
  tavan: 'Tavan',
  kolon: 'Kolon',
  kiris: 'Kiriş',
  lavabo: 'Lavabo',
  klozet: 'Klozet',
  dusakabin: 'Duşakabin',
  klima: 'Klima',
  radyator: 'Radyatör',
  merdiven: 'Merdiven',
  asma_tavan: 'Asma Tavan',
  pvc_dograma: 'Pvc Doğrama',
  ahsap_dograma: 'Ahşap Doğrama',
  diger: 'Diğer',
};

/** Örnek kaynaklar — DB TEXT; yeni kaynak schema değişikliği gerektirmez */
export const SMART_MEASURE_SOURCE_EXAMPLES = [
  'mobile_ar',
  'lidar',
  'manual',
  'manual_correction',
  'api_import',
  'drone',
  'video',
  'digital_twin',
  'bim_import',
  'cad_import',
  'room_scan',
] as const;

export const SMART_MEASURE_ELEMENT_STATUSES = [
  'draft',
  'measured',
  'reviewed',
  'approved',
  'archived',
] as const;

export type SmartMeasureElementStatus = (typeof SMART_MEASURE_ELEMENT_STATUSES)[number];

export const SMART_MEASURE_ELEMENT_STATUS_LABELS: Record<SmartMeasureElementStatus, string> = {
  draft: 'Draft',
  measured: 'Measured',
  reviewed: 'Reviewed',
  approved: 'Approved',
  archived: 'Archived',
};
