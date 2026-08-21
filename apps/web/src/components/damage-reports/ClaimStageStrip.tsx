'use client';

import {
  CLAIM_FILE_STAGE_SLOTS,
  claimFileStageTone,
  deriveClaimFileStageIndex,
  hasClaimFileSuppliersAssigned,
} from '@sigorta/shared';
import { FileStageStrip, type FileStageStep } from '@/components/panel/FileStageStrip';

export type ClaimStageStripSource = {
  reportStatus?: string | null;
  claimStatusCode?: string | null;
  claimFile?: {
    currentStatus?: { code?: string | null } | null;
    assignedSupplierId?: string | null;
    assignedSupplier?: { id?: string } | null;
    assignedSuppliers?: Array<{ id?: string } | null> | null;
    supplierAssignments?: Array<{ vendorId?: string; vendor?: { id?: string } | null } | null> | null;
    supplierAssignedAt?: string | Date | null;
  } | null;
  hasSuppliersAssigned?: boolean;
};

function resolveActiveIndex(source: ClaimStageStripSource): number | null {
  const claimFile = source.claimFile ?? null;
  return deriveClaimFileStageIndex({
    reportStatus: source.reportStatus,
    claimStatusCode: source.claimStatusCode ?? claimFile?.currentStatus?.code ?? null,
    hasSuppliersAssigned:
      source.hasSuppliersAssigned ?? hasClaimFileSuppliersAssigned(claimFile),
  });
}

/**
 * Hasar dosya akışı — adımlar hasar iş kuralından, görünüm ortak şeritten gelir.
 */
export function ClaimStageStrip({
  source,
  compact = true,
  showTitle = true,
  className = '',
}: {
  source: ClaimStageStripSource;
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
}) {
  const activeIndex = resolveActiveIndex(source);
  const steps: FileStageStep[] = CLAIM_FILE_STAGE_SLOTS.map((slot, idx) => ({
    key: slot.id,
    label: slot.label,
    tone: claimFileStageTone(idx, activeIndex),
  }));

  return (
    <FileStageStrip
      steps={steps}
      compact={compact}
      showTitle={showTitle}
      className={className}
      testId="claim-stage-strip"
    />
  );
}
