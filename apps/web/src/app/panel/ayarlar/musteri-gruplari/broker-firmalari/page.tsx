'use client';

import SettingsLegacyRedirect from '@/components/settings/SettingsLegacyRedirect';

export default function LegacyBrokerRedirectPage() {
  return <SettingsLegacyRedirect target="/panel/musteriler?openAdd=1&subType=broker_firmasi&entityType=corporate" />;
}
