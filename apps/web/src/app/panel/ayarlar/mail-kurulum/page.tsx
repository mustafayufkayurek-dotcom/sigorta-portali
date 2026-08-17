'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

/** Eski URL — içerik Mail ve Bildirim Merkezi'nde birleştirildi */
export default function MailKurulumRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/ayarlar/e-posta-bildirimleri" />;
}
