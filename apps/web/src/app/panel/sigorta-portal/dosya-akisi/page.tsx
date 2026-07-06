'use client';

import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';
import { hasInsuranceCompanyUserAccess } from '@/utils/portal-insurance-scope';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

export default function SigortaDosyaAkisiPage() {
  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/sigorta-portal"
      portalHomeLabel="Sigorta Portal"
      listTitle="Sigorta Dosyalarınız"
      emptyHint="Sigorta şirketinize bağlı dosyalar burada listelenir."
      filesLinkHref="/panel/sigorta-portal/dosyalar"
      filesLinkLabel="Dosyalar"
      filesApiUrl={`${API}/claim-files?limit=50`}
      assertAccess={hasInsuranceCompanyUserAccess}
      scopeRequiredMessage="Sigorta şirketi kapsamı tanımlı değil. Meridyen operasyon ekibinden kapsam ataması isteyin."
    />
  );
}
