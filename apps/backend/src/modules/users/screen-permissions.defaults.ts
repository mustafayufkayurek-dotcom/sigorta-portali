export const ALL_SCREEN_CODES = [
  'hasar_dosyalari',
  'acil_yardim',
  'finans',
  'operasyon',
  'eksperler',
  'musteriler',
  'tedarikciler',
  'raporlar',
  'ayarlar',
  'kullanicilar',
  'guvenlik',
  'harita',
  'personel_yonetimi',
] as const;

export type ScreenCode = (typeof ALL_SCREEN_CODES)[number];

export const SCREEN_LABELS: Record<string, string> = {
  hasar_dosyalari:   'Hasar Dosyaları',
  acil_yardim:       'Acil Yardım',
  finans:            'Finans',
  operasyon:         'Operasyon',
  eksperler:         'Eksperler',
  musteriler:        'Müşteriler',
  tedarikciler:      'Tedarikçiler',
  raporlar:          'Raporlar',
  ayarlar:           'Ayarlar',
  kullanicilar:      'Kullanıcılar',
  guvenlik:          'Güvenlik',
  harita:            'Harita',
  personel_yonetimi: 'Personel Yönetimi',
};

export const ROLE_DEFAULT_SCREENS: Record<string, string[]> = {
  admin: [
    'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon', 'eksperler',
    'musteriler', 'tedarikciler', 'raporlar', 'ayarlar', 'kullanicilar',
    'guvenlik', 'harita', 'personel_yonetimi',
  ],
  office_staff: [
    'hasar_dosyalari', 'musteriler', 'tedarikciler', 'eksperler',
    'operasyon', 'acil_yardim', 'harita',
  ],
  field_staff: [
    'hasar_dosyalari', 'operasyon',
  ],
  accountant: [
    'finans', 'raporlar',
  ],
  expert: [],
  insurance_company_user: [],
};

export function getDefaultScreensForRole(roleCode: string): string[] {
  const code = roleCode.toLowerCase();
  return ROLE_DEFAULT_SCREENS[code] ?? [];
}
