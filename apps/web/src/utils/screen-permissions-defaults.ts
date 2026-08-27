const ROLE_DEFAULT_SCREENS: Record<string, string[]> = {
  admin: [
    'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon',
    'musteriler', 'tedarikciler', 'raporlar', 'ayarlar', 'kullanicilar',
    'guvenlik', 'harita', 'personel_yonetimi', 'personel_ozluk',
  ],
  manager: [
    'hasar_dosyalari', 'acil_yardim', 'finans', 'operasyon',
    'musteriler', 'tedarikciler', 'raporlar', 'harita', 'personel_yonetimi', 'personel_ozluk',
  ],
  office_staff: [
    'hasar_dosyalari', 'musteriler', 'tedarikciler',
    'operasyon', 'acil_yardim', 'harita', 'personel_ozluk',
  ],
  field_staff: [
    'hasar_dosyalari', 'operasyon', 'personel_ozluk',
  ],
  accountant: [
    'finans', 'raporlar', 'personel_ozluk',
  ],
  finance: [
    'finans', 'raporlar', 'operasyon',
    'musteriler', 'tedarikciler', 'hasar_dosyalari', 'personel_ozluk',
  ],
};

export function getDefaultScreensForRole(roleCode: string): string[] {
  const code = String(roleCode ?? '').trim().toLowerCase();
  const aliased = code === 'finans' ? 'finance' : code;
  return ROLE_DEFAULT_SCREENS[aliased] ?? [];
}
