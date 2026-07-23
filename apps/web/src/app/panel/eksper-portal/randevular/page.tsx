'use client';

import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';

function assertExpertAccess(user: { role?: { code?: string } }) {
  return user?.role?.code === 'expert';
}

export default function EksperDosyaAkisiPage() {
  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/eksper-portal"
      portalHomeLabel="Eksper Paneli"
      listTitle="Dosyalarınız"
      emptyHint="İhbarını yaptığınız veya işlem yaptığınız dosyalar burada listelenir."
      filesLinkHref="/panel/eksper-portal/dosyalar"
      filesLinkLabel="Dosyalarım"
      assertAccess={assertExpertAccess}
    />
  );
}
