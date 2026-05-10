export const ENTITY_NAMES = {
  claimFile: 'Hasar Dosyası',
  customer: 'Sigortalı',
  expert: 'Eksper',
  supplier: 'Tedarikçi',
  stage: 'Aşama',
  status: 'Durum',
  budget: 'Bütçe',
  report: 'Rapor',
  note: 'Not',
  waiting: 'Bekleme',
} as const;

export type EntityKey = keyof typeof ENTITY_NAMES;
