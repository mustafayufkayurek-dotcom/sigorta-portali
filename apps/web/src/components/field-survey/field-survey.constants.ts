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

export const FIELD_SURVEY_ITEM_TYPE_OPTIONS: { value: FieldSurveyItemType; label: string }[] = [
  { value: 'mutfak_alt_modul', label: 'Mutfak Alt Modül' },
  { value: 'mutfak_ust_modul', label: 'Mutfak Üst Modül' },
  { value: 'kapi', label: 'Kapı' },
  { value: 'lavabo_alt', label: 'Lavabo Alt Dolap' },
  { value: 'lavabo_ust', label: 'Lavabo Üst Dolap' },
  { value: 'ada_tezgah', label: 'Ada Tezgah' },
  { value: 'parke', label: 'Parke / Zemin' },
  { value: 'boya', label: 'Boya / Duvar' },
  { value: 'seramik_fayans', label: 'Seramik / Fayans' },
  { value: 'alci_tavan', label: 'Alçı / Tavan' },
  { value: 'diger', label: 'Diğer' },
];
