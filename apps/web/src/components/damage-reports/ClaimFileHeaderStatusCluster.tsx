'use client';

import type { ReactNode } from 'react';
import {
  ClaimStageStrip,
  type ClaimStageStripSource,
} from '@/components/damage-reports/ClaimStageStrip';

/**
 * Sağ üst sıkı küme: Dosya Akışı (başlık + çizgi) · ekstra rozet · ⋮
 * Sağdaki rapor durumu rozeti (Onay Bekliyor) bilerek yok — tekrar / alan ihlali önlenir.
 */
export function ClaimFileHeaderStatusCluster({
  statusBadge: _statusBadge,
  extraBadges,
  actionsMenu,
  stageSource,
  showTitle = true,
}: {
  /** @deprecated Sağ rozet kaldırıldı; prop geri uyumluluk için tutulur. */
  statusBadge?: ReactNode;
  extraBadges?: ReactNode;
  actionsMenu?: ReactNode;
  stageSource: ClaimStageStripSource;
  showTitle?: boolean;
}) {
  return (
    <div
      className="flex w-full min-w-0 max-w-full items-center justify-start gap-2 sm:ml-auto sm:w-auto sm:justify-end sm:shrink-0"
      data-testid="claim-header-status-cluster"
    >
      <div
        className="min-w-0 flex-1 sm:w-[15rem] sm:flex-none sm:pr-1"
        data-testid="claim-header-stage-strip"
      >
        <ClaimStageStrip source={stageSource} compact showTitle={showTitle} />
      </div>
      {extraBadges}
      <div className="shrink-0">{actionsMenu}</div>
    </div>
  );
}
