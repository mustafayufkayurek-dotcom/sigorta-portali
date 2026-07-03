'use client';

import { useState } from 'react';
import { SubTabNav } from './sub-tab-nav';
import { GorevlerTab } from './GorevlerTab';
import { RandevularTab } from './RandevularTab';

type TakipSubTab = 'gorevler' | 'randevular';

const TAKIP_SUB_TABS: { id: TakipSubTab; label: string }[] = [
  { id: 'gorevler', label: 'Görevler' },
  { id: 'randevular', label: 'Randevular' },
];

export function TakipTab({ claimId, claim }: { claimId: string; claim: any }) {
  const [subTab, setSubTab] = useState<TakipSubTab>('gorevler');

  return (
    <div className="space-y-4">
      <SubTabNav tabs={TAKIP_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'gorevler' && <GorevlerTab claimId={claimId} />}
      {subTab === 'randevular' && <RandevularTab claimId={claimId} claim={claim} />}
    </div>
  );
}
