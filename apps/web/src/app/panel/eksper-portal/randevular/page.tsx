'use client';

import { useMemo } from 'react';
import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function assertExpertAccess(user: { role?: { code?: string } }) {
  return user?.role?.code === 'expert';
}

export default function EksperDosyaAkisiPage() {
  const filesApiUrl = useMemo(() => `${API}/claim-files?limit=50`, []);

  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/eksper-portal"
      portalHomeLabel="Eksper Paneli"
      listTitle="Dosyalarınız"
      emptyHint="Size atanan veya ihbar ettiğiniz dosyalar burada listelenir."
      filesLinkHref="/panel/eksper-portal/dosyalar"
      filesLinkLabel="Dosyalarım"
      filesApiUrl={filesApiUrl}
      assertAccess={assertExpertAccess}
    />
  );
}
