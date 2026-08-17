'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

export default function LegacyMusteriGrubuRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/musteriler?openAdd=1&subType=sigorta_sirketi&entityType=corporate" />;
}
