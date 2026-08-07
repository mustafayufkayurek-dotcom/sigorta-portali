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
}: {
  /** @deprecated Sağ rozet kaldırıldı; prop geri uyumluluk için tutulur. */
  statusBadge?: ReactNode;
  extraBadges?: ReactNode;
  actionsMenu?: ReactNode;
  stageSource: ClaimStageStripSource;
}) {
  return (
    <div
      className="ml-auto flex min-w-0 max-w-full shrink-0 items-center justify-end gap-2"
      data-testid="claim-header-status-cluster"
    >
      <div
        className="min-w-0 w-[12.5rem] sm:w-[15rem]"
        data-testid="claim-header-stage-strip"
      >
        <ClaimStageStrip source={stageSource} compact showTitle />
      </div>
      {extraBadges}
      {actionsMenu}
    </div>
  );
}
