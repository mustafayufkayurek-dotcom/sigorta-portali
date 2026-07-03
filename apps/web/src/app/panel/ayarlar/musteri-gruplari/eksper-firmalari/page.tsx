'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

export default function LegacyEksperRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/musteriler?openAdd=1&subType=eksper_firmasi&entityType=corporate" />;
}
