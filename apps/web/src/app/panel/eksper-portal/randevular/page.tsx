'use client';

import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';

function assertExpertAccess(user: { role?: { code?: string } }) {
  return user?.role?.code === 'expert';
}

export default function EksperDosyaAkisiPage() {
  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/eksper-portal"
      portalHomeLabel={(() => {
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
          if (!raw) return 'Eksper Paneli';
          const u = JSON.parse(raw);
          const role = String(u?.role?.code ?? '').trim().toLowerCase();
          const firm = String(u?.portalCustomerName ?? '').trim();
          if (role === 'broker_user') return firm || 'Broker Paneli';
          return firm || 'Eksper Paneli';
        } catch {
          return 'Eksper Paneli';
        }
      })()}
      listTitle="Dosyalarınız"
      emptyHint="İhbarını yaptığınız veya işlem yaptığınız dosyalar burada listelenir."
      filesLinkHref="/panel/eksper-portal/dosyalar"
      filesLinkLabel="Dosyalarım"
      assertAccess={assertExpertAccess}
    />
  );
}
