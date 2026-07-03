'use client';

import { useState } from 'react';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import { SectionCard } from '../claim-detail-ui';
import { SubTabNav } from './sub-tab-nav';
import { DokumanlarTab } from './DokumanlarTab';
import { EvrakOzetPanel, type EvrakSubTab } from './EvrakOzetPanel';
import { SozlesmelerSection } from './SozlesmelerSection';

const EVRAK_SUB_TABS: { id: EvrakSubTab; label: string }[] = [
  { id: 'ozet', label: 'Özet' },
  { id: 'sozlesmeler', label: 'Sözleşmeler & Onaylar' },
  { id: 'arsiv', label: 'Evrak Arşivi' },
  { id: 'kapama', label: 'Kapama' },
];

function YakindaPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="text-xs text-slate-400 mt-1">Yakında</p>
    </div>
  );
}

function SozlesmelerOnaylarPanel({
  claimId,
  claim,
}: {
  claimId: string;
  claim: any;
}) {
  const isTahsilatli = claim?.requiresOnlineCardCollection === true;

  return (
    <div className="space-y-6">
      <SectionCard title="Muvafakatname">
        <FileDocumentPanel
          entityType="claim_file"
          entityId={claimId}
          documentKind="muvafakatname"
        />
      </SectionCard>

      <SectionCard title="Tedarikçi Sözleşmeleri">
        <SozlesmelerSection claimId={claimId} hideHeader />
      </SectionCard>

      {isTahsilatli && (
        <>
          <SectionCard title="Sigortalı Sözleşmesi">
            <YakindaPlaceholder title="Sigortalı Sözleşmesi" />
          </SectionCard>
          <SectionCard title="Onarım Kabul">
            <YakindaPlaceholder title="Onarım Kabul Formu" />
          </SectionCard>
        </>
      )}
    </div>
  );
}

export function EvraklarTab({
  claimId,
  claim,
}: {
  claimId: string;
  claim: any;
}) {
  const [subTab, setSubTab] = useState<EvrakSubTab>('ozet');

  return (
    <div className="space-y-4">
      <SubTabNav tabs={EVRAK_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'ozet' && (
        <EvrakOzetPanel claimId={claimId} onNavigate={setSubTab} />
      )}

      {subTab === 'sozlesmeler' && (
        <SozlesmelerOnaylarPanel claimId={claimId} claim={claim} />
      )}

      {subTab === 'arsiv' && <DokumanlarTab claimId={claimId} />}

      {subTab === 'kapama' && (
        <SectionCard title="Dosya Kapama & Fatura Talebi">
          <ClosureConditionsPanel
            serviceType="claim"
            entityId={claimId}
            fileNo={claim?.fileNo ?? ''}
            insuranceCompanyId={claim?.insuranceCompanyId}
            insuranceCompanyName={claim?.insuranceCompany?.name}
            totalAmount={claim?.budget?.totalAmount ?? 0}
            workItemsSummary={[]}
          />
        </SectionCard>
      )}
    </div>
  );
}
