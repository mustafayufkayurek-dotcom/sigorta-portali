'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

/** Eski URL — Fiyat Listesi sayfasına yönlendirir. */
export default function FiyatYonetimiRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/ayarlar/fiyat-listesi" />;
}
