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
  hasar_dosyalari: 'Hasar Dosyaları',
  acil_yardim: 'Acil Yardım',
  finans: 'Finans',
  operasyon: 'Operasyon',
  musteriler: 'Müşteriler',
  tedarikciler: 'Tedarikçiler',
  raporlar: 'Raporlar',
  ayarlar: 'Ayarlar',
  kullanicilar: 'Kullanıcılar',
  guvenlik: 'Güvenlik',
  harita: 'Harita',
  personel_yonetimi: 'Personel Yönetimi',
  test_notes_admin: 'Test Notları ve Görev Takip',
};