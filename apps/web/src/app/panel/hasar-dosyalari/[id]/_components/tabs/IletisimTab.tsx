'use client';

import { InboundEmailCorrespondencePanel } from '@/components/operation-inbox/InboundEmailCorrespondencePanel';
import { FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { IletisimGunluguPanel } from './IletisimGunluguPanel';
import { YazismalarTab } from './YazismalarTab';

export function IletisimTab({ claimId }: { claimId: string }) {
  return (
    <div className="space-y-4">
      <IletisimGunluguPanel claimId={claimId} />

      <FinansPanelCard
        title="WhatsApp Yazışmaları"
        subtitle="Sohbet arşivi"
      >
        <YazismalarTab claimId={claimId} embedded />
      </FinansPanelCard>

      <FinansPanelCard
        title="Gelen E-Posta"
        subtitle="Dosyaya bağlı e-postalar"
        noPadding
      >
        <InboundEmailCorrespondencePanel claimFileId={claimId} />
      </FinansPanelCard>
    </div>
  );
}
