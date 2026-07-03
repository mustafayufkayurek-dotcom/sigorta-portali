'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

export default function LegacyAsistansRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/musteriler?openAdd=1&subType=asistan_firmasi&entityType=corporate" />;
}
