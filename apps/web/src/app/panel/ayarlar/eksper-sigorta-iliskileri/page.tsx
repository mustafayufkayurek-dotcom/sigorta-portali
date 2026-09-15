'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

/** Kare kutu kalktı. İlişki müşteri kartı ve CRM’de dosyadan tanınır. */
export default function EksperSigortaIliskileriRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/musteriler?subType=eksper_firmasi" />;
}
