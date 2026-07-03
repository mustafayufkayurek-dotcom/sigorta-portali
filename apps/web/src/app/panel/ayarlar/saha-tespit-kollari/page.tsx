'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

/** Eski URL — Saha Tespit Kolları kaldırıldı (Senaryo B: atama dosyadan yapılır) */
export default function SahaTespitKollariRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/ayarlar/tanimlar" />;
}
