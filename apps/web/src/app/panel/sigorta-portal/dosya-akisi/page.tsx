'use client';

import { useEffect, useState } from 'react';
import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function assertInsuranceAccess(user: { role?: { code?: string }; insuranceCompanyScopes?: { id: string }[] }) {
  return user?.role?.code === 'insurance_company_user';
}

export default function SigortaDosyaAkisiPage() {
  const [filesApiUrl, setFilesApiUrl] = useState(`${API}/claim-files?limit=50`);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    const scopes: { id: string }[] = u.insuranceCompanyScopes ?? [];
    if (scopes.length === 0) return;
    const companyQuery = scopes.map((s) => `insuranceCompanyIds[]=${s.id}`).join('&');
    setFilesApiUrl(`${API}/claim-files?${companyQuery}&limit=50`);
  }, []);

  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/sigorta-portal"
      portalHomeLabel="Sigorta Portal"
      listTitle="Sigorta Dosyalarınız"
      emptyHint="Sigorta şirketinize bağlı dosyalar burada listelenir."
      filesLinkHref="/panel/sigorta-portal/dosyalar"
      filesLinkLabel="Dosyalar"
      filesApiUrl={filesApiUrl}
      assertAccess={assertInsuranceAccess}
    />
  );
}
