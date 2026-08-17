import { canAccessTestNotesFromStorage } from '@/utils/test-notes-access';

/** Tanım CRUD sayfalarının standart geri linki */
export const TANIMLAR_BACK_HREF = '/panel/ayarlar/tanimlar';
export const TANIMLAR_BACK_TEXT = '← Tanımlar Merkezi';

export const DEFINITION_SETTINGS_PAGES = [
  '/panel/ayarlar/personel',
  '/panel/ayarlar/musteri-tipleri',
  '/panel/ayarlar/sigorta-sirketleri',
  '/panel/ayarlar/eksper-sigorta-iliskileri',
  '/panel/ayarlar/departmanlar',
  '/panel/ayarlar/iliski-turleri',
  '/panel/ayarlar/dosya-konulari',
  '/panel/ayarlar/durumlar',
  '/panel/ayarlar/evrak-turleri',
  '/panel/ayarlar/tedarikci-hizmet-kollari',
  '/panel/ayarlar/is-gruplari',
  '/panel/ayarlar/masraf-kategorileri',
  '/panel/ayarlar/mahaller',
  '/panel/ayarlar/fiyat-listesi',
  '/panel/ayarlar/bolgesel-zamlar',
  '/panel/ayarlar/eskalasyon-kurallari',
  '/panel/ayarlar/musteri-gruplari',
  '/panel/ayarlar/musteri-gruplari/sigorta-sirketleri',
  '/panel/ayarlar/musteri-gruplari/broker-firmalari',
  '/panel/ayarlar/musteri-gruplari/eksper-firmalari',
  '/panel/ayarlar/musteri-gruplari/asistans-firmalar',
  '/panel/ayarlar/musteri-gruplari/eksper-sigorta-iliskileri',
] as const;

export function canAccessTestNotesHub(): boolean {
  return canAccessTestNotesFromStorage();
}
