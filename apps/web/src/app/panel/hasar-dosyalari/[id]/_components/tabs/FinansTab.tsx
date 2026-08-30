'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FinansOzetPanel } from './FinansOzetPanel';
import { FaturalarTab } from './finans-subtabs';
import { FileMasrafIsleme } from '@/components/finance/FileMasrafIsleme';
import { ClaimFileGelirTahsilatPanel } from '@/components/finance/ClaimFileGelirTahsilatPanel';

type FinansSubTab = 'ozet' | 'gelir-tahsilat' | 'gider-butce' | 'faturalar';

const FINANS_SUB_TABS: { id: FinansSubTab; label: string }[] = [
  { id: 'ozet', label: 'Özet' },
  { id: 'gelir-tahsilat', label: 'Gelir & Tahsilat' },
  { id: 'gider-butce', label: 'Gider & Bütçe' },
  { id: 'faturalar', label: 'Faturalar' },
];

function finansAltTab(alt: string | null): FinansSubTab {
  if (alt === 'gider-butce' || alt === 'gider') return 'gider-butce';
  if (alt === 'gelir-tahsilat' || alt === 'gelir') return 'gelir-tahsilat';
  if (alt === 'faturalar') return 'faturalar';
  return 'ozet';
}

export function FinansTab({
  claim,
  claimId,
}: {
  claim: any;
  claimId: string;
}) {
  const searchParams = useSearchParams();
  const [subTab, setSubTab] = useState<FinansSubTab>(() => finansAltTab(searchParams.get('alt')));

  return (
    <div className="space-y-4">
      <div className="sticky top-[52px] z-10 -mx-1 px-1 py-2 bg-[#f8fafc]/95 backdrop-blur-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {FINANS_SUB_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                subTab === tab.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'ozet' && (
        <FinansOzetPanel
          claim={claim}
          claimId={claimId}
        />
      )}

      {subTab === 'gelir-tahsilat' && (
        <ClaimFileGelirTahsilatPanel claimId={claimId} />
      )}

      {subTab === 'gider-butce' && (
        <FileMasrafIsleme
          claimId={claimId}
          fileLabel={claim?.fileNo ?? claim?.claimNo}
          reportId={claim?.latestRepairReport?.id}
          supplierCostHint={
            Number(claim?.latestRepairReport?.totalSupplierCost)
            || Number(claim?.financialSummary?.estimatedCost)
            || Number(claim?.estimatedCostAmount)
            || null
          }
        />
      )}

      {subTab === 'faturalar' && (
        <FaturalarTab claimId={claimId} claim={claim} />
      )}
    </div>
  );
}
