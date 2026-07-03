'use client';

import { useState } from 'react';
import { InboundEmailCorrespondencePanel } from '@/components/operation-inbox/InboundEmailCorrespondencePanel';
import { SubTabNav } from './sub-tab-nav';
import { TalimatlarTab } from './TalimatlarTab';
import { NotlarTab } from './NotlarTab';
import { YazismalarTab } from './YazismalarTab';

type IletisimSubTab = 'talimatlar' | 'notlar' | 'yazismalar' | 'eposta';

const ILETISIM_SUB_TABS: { id: IletisimSubTab; label: string }[] = [
  { id: 'talimatlar', label: 'Talimatlar' },
  { id: 'notlar', label: 'Notlar' },
  { id: 'yazismalar', label: 'Yazışmalar' },
  { id: 'eposta', label: 'Gelen E-Posta' },
];

export function IletisimTab({ claimId }: { claimId: string }) {
  const [subTab, setSubTab] = useState<IletisimSubTab>('talimatlar');

  return (
    <div className="space-y-4">
      <SubTabNav tabs={ILETISIM_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'talimatlar' && <TalimatlarTab claimId={claimId} />}
      {subTab === 'notlar' && <NotlarTab claimId={claimId} />}
      {subTab === 'yazismalar' && <YazismalarTab claimId={claimId} />}
      {subTab === 'eposta' && <InboundEmailCorrespondencePanel claimFileId={claimId} />}
    </div>
  );
}
