/** Saha keşif ölçüsü — marangoz, boya, seramik, parke vb. ortak parça tipleri */
export type FieldSurveyItemType =
  | 'mutfak_alt_modul'
  | 'mutfak_ust_modul'
  | 'kapi'
  | 'lavabo_alt'
  | 'lavabo_ust'
  | 'ada_tezgah'
  | 'parke'
  | 'boya'
  | 'seramik_fayans'
  | 'alci_tavan'
  | 'diger';

export const FIELD_SURVEY_ITEM_TYPES: FieldSurveyItemType[] = [
  'mutfak_alt_modul',
  'mutfak_ust_modul',
  'kapi',
  'lavabo_alt',
  'lavabo_ust',
  'ada_tezgah',
  'parke',
  'boya',
  'seramik_fayans',
  'alci_tavan',
  'diger',
];

export const FIELD_SURVEY_ITEM_TYPE_LABELS: Record<FieldSurveyItemType, string> = {
  mutfak_alt_modul: 'Mutfak Alt Modül',
  mutfak_ust_modul: 'Mutfak Üst Modül',
  kapi: 'Kapı',
  lavabo_alt: 'Lavabo Alt Dolap',
  lavabo_ust: 'Lavabo Üst Dolap',
  ada_tezgah: 'Ada Tezgah',
  parke: 'Parke / Zemin',
  boya: 'Boya / Duvar',
  seramik_fayans: 'Seramik / Fayans',
  alci_tavan: 'Alçı / Tavan',
  diger: 'Diğer',
};
