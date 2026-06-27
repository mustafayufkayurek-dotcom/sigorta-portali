'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

/** Eski sekme tabanlı kurulum ekranı kaldırıldı — Şirket Bilgileri ana giriş noktası */
export default function KurulumRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/ayarlar/sirket-bilgileri" />;
}
