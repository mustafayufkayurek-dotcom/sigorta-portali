'use client';

import PortalFileFlowPage from '@/components/portal/PortalFileFlowPage';
import { hasInsuranceCompanyUserAccess } from '@/utils/portal-insurance-scope';

export default function SigortaDosyaAkisiPage() {
  return (
    <PortalFileFlowPage
      portalHomeHref="/panel/sigorta-portal"
      portalHomeLabel="Dosya Takip"
      listTitle="Dosyalarınız"
      emptyHint="Sigorta şirketinize bağlı dosyalar burada listelenir."
      filesLinkHref="/panel/sigorta-portal/dosyalar"
      filesLinkLabel="Dosyalar"
      assertAccess={hasInsuranceCompanyUserAccess}
      scopeRequiredMessage="Sigorta şirketi kapsamı tanımlı değil. Meridyen operasyon ekibinden kapsam ataması isteyin."
    />
  );
}
