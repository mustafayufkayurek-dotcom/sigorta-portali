import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export const SETTINGS_HUB_PATH = '/panel/ayarlar';

/** Ayarlar ana sayfasında gösterilecek kayıt mesajları (?kayit=...) */
export const SETTINGS_SAVE_MESSAGES: Record<string, string> = {
  'sirket-bilgileri': 'Şirket bilgileri kaydedildi.',
  'mail-kurulum': 'SMTP ayarları kaydedildi.',
  'sms-bildirimler': 'SMS bildirim ayarları kaydedildi.',
  'entegrasyonlar': 'Entegrasyon ayarları kaydedildi.',
  'entegrasyonlar-sms': 'SMS entegrasyon ayarları kaydedildi.',
  'entegrasyonlar-turmob': 'TÜRMOB entegrasyon ayarları kaydedildi.',
  'entegrasyonlar-logo-wings': 'Logo Wings entegrasyon ayarları kaydedildi.',
  'eskalasyon-kurallari': 'Eskalasyon kuralları kaydedildi.',
  'e-posta-bildirimleri-smtp': 'SMTP ayarları kaydedildi.',
  'e-posta-bildirimleri-kurallar': 'Bildirim kuralları kaydedildi.',
  'alan-zorunluluklari': 'Alan zorunlulukları kaydedildi.',
  'kurulum-logo': 'Logo kaydedildi.',
  'kurulum-mail': 'Mail ayarları kaydedildi.',
  'kurulum-sms': 'SMS ayarları kaydedildi.',
  'kurulum-uyari': 'Uyarı kuralları kaydedildi.',
  'kurulum-entegrasyon': 'Entegrasyon ayarları kaydedildi.',
  'kurulum-sistem': 'Sistem ayarları kaydedildi.',
};

export function redirectAfterSettingsSave(router: AppRouterInstance, key: string) {
  router.push(`${SETTINGS_HUB_PATH}?kayit=${encodeURIComponent(key)}`);
}

export function getSettingsSaveMessage(key: string | null): string | null {
  if (!key) return null;
  return SETTINGS_SAVE_MESSAGES[key] ?? 'Kayıt tamamlandı.';
}
