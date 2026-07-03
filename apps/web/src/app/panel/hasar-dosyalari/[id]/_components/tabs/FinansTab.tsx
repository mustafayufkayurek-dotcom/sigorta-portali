'use client';

import { useState } from 'react';
import { FinansOzetPanel } from './FinansOzetPanel';
import {
  ButceTab,
  EkstraIslerTab,
  FaturalarTab,
  GelirlerTab,
  TahsilatlarTab,
} from './finans-subtabs';

type FinansSubTab = 'ozet' | 'gelir-tahsilat' | 'gider-butce' | 'faturalar';

const FINANS_SUB_TABS: { id: FinansSubTab; label: string }[] = [
  { id: 'ozet', label: 'Özet' },
  { id: 'gelir-tahsilat', label: 'Gelir & Tahsilat' },
  { id: 'gider-butce', label: 'Gider & Bütçe' },
  { id: 'faturalar', label: 'Faturalar' },
];

export function FinansTab({
  claim,
  claimId,
  onOpenRaporlarTab,
}: {
  claim: any;
  claimId: string;
  onOpenRaporlarTab?: () => void;
}) {
  const [subTab, setSubTab] = useState<FinansSubTab>('ozet');

  return (
    <div className="space-y-4">
      <div className="sticky top-[52px] z-10 -mx-1 px-1 py-2 bg-[#f8fafc]/95 backdrop-blur-sm">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FINANS_SUB_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                subTab === tab.id
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
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
          onOpenRaporlarTab={onOpenRaporlarTab}
        />
      )}

      {subTab === 'gelir-tahsilat' && (
        <div className="space-y-6">
          <GelirlerTab claimId={claimId} />
          <TahsilatlarTab claimId={claimId} />
        </div>
      )}

      {subTab === 'gider-butce' && (
        <div className="space-y-6">
          <EkstraIslerTab claimId={claimId} />
          <ButceTab claimId={claimId} claimCity={claim?.propertyAddress?.city} />
        </div>
      )}

      {subTab === 'faturalar' && (
        <FaturalarTab claimId={claimId} claim={claim} />
      )}
    </div>
  );
}
