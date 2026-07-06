export const ALL_SCREEN_CODES = [
  'hasar_dosyalari',
  'acil_yardim',
  'finans',
  'operasyon',
  'musteriler',
  'tedarikciler',
  'raporlar',
  'ayarlar',
  'kullanicilar',
  'guvenlik',
  'harita',
  'personel_yonetimi',
  'test_notes_admin',
] as const;

export type ScreenCode = (typeof ALL_SCREEN_CODES)[number];

export const SCREEN_LABELS: Record<string, string> = {
  hasar_dosyalari:   'Hasar Dosyaları',
  acil_yardim:       'Acil Yardım',
  finans:            'Finans',
  operasyon:         'Operasyon',
  musteriler:        'Müşteriler',
  tedarikciler:      'Tedarikçiler',
  raporlar:          'Raporlar',
  ayarlar:           'Ayarlar',
  kullanicilar:      'Kullanıcılar',
  guvenlik:          'Güvenlik',
  harita:            'Harita',
  personel_yonetimi: 'Personel Yönetimi',
  test_notes_admin: 'Test Notları ve Görev Takip',
};

export const ROLE_DEFAULT_SCREENS: Record<string, string[]> = {
  admin: [
    'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon',
    'musteriler', 'tedarikciler', 'raporlar', 'ayarlar', 'kullanicilar',
    'guvenlik', 'harita', 'personel_yonetimi',
    'test_notes_admin',
  ],
  manager: [
    'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon',
    'musteriler', 'tedarikciler', 'raporlar', 'harita', 'personel_yonetimi',
  ],
  office_staff: [
    'hasar_dosyalari', 'musteriler', 'tedarikciler',
    'operasyon', 'acil_yardim', 'harita',
    'test_notes_admin',
  ],
  field_staff: [
    'hasar_dosyalari', 'operasyon',
  ],
  accountant: [
    'finans', 'raporlar', 'test_notes_admin',
  ],
  finance: [
    'finans', 'raporlar', 'operasyon',
    'musteriler', 'tedarikciler', 'hasar_dosyalari',
    'test_notes_admin',
  ],
  expert: [],
  insurance_company_user: [],
};

export function getDefaultScreensForRole(roleCode: string): string[] {
  const code = roleCode.toLowerCase();
  return ROLE_DEFAULT_SCREENS[code] ?? [];
}
